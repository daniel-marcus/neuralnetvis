import * as React from "react"
import * as THREE from "three/webgpu"
import { context, createPortal, useFrame, useThree } from "@react-three/fiber"
import tunnel from "tunnel-rat"
import type {
  ComputeFunction,
  RootState as RootStateGL,
} from "@react-three/fiber"

// drei/View component adapted for WebGPURenderer
// original: https://github.com/pmndrs/drei/blob/master/src/web/View.tsx

export type RootState = RootStateGL & {
  gl: THREE.WebGPURenderer // instead of THREE.WebGLRenderer
}

const isOrthographicCamera = (def: any): def is THREE.OrthographicCamera =>
  def && (def as THREE.OrthographicCamera).isOrthographicCamera
const col = /* @__PURE__ */ new THREE.Color()
const tracked = /* @__PURE__ */ tunnel()

type CanvasSize = {
  top: number
  left: number
  height: number
  width: number
}

type DOMPosition = {
  width: number
  height: number
  top: number
  left: number
  bottom: number
  right: number
}

export type ContainerProps = {
  visible: boolean
  scene: THREE.Scene
  index: number
  children?: React.ReactNode
  frames: number
  rect: React.RefObject<DOMRect>
  /**
   * @deprecated You can use inline Views now, see: https://github.com/pmndrs/drei/pull/1784
   */
  track?: React.RefObject<HTMLElement>
  canvasSize: CanvasSize
  copyCanvas?: boolean
  onFirstRender?: () => void
}

export type ViewProps = {
  /** Root element type, default: div */
  as?: string
  /** CSS id prop */
  id?: string
  /** CSS classname prop */
  className?: string
  /** CSS style prop */
  style?: React.CSSProperties
  /** If the view is visible or not, default: true */
  visible?: boolean
  /** Views take over the render loop, optional render index (1 by default) */
  index?: number
  /** If you know your view is always at the same place set this to 1 to avoid needless getBoundingClientRect overhead */
  frames?: number
  /** The scene to render, if you leave this undefined it will render the default scene */
  children?: React.ReactNode
  /** The tracking element, the view will be cut according to its whereabouts
   * @deprecated You can use inline Views now, see: https://github.com/pmndrs/drei/pull/1784
   */
  track?: React.RefObject<HTMLElement>
  /** If set true, the content from the background rendering canvas will be copied to a canvas for the current view. Might be helpful when the content needs to appear in a specific stacking context (befor a map background etc.)   */
  copyCanvas?: boolean
  onFirstRender?: () => void
}

function computeContainerPosition(canvasSize: CanvasSize, trackRect: DOMRect) {
  const {
    right,
    top,
    left: trackLeft,
    bottom: trackBottom,
    width,
    height,
  } = trackRect
  const isOffscreen =
    trackRect.bottom < 0 ||
    top > canvasSize.height ||
    right < 0 ||
    trackRect.left > canvasSize.width

  const canvasBottom = canvasSize.top + canvasSize.height
  const bottom = canvasBottom - trackBottom
  const left = trackLeft - canvasSize.left

  return {
    position: { width, height, left, top, bottom, right },
    isOffscreen,
  }
}

function prepareSkissor(
  state: RootState,
  pos: DOMPosition,
  canvasSize: CanvasSize
) {
  const { left, top, width, height } = pos
  // const aspect = width / height
  const aspect = canvasSize.width / canvasSize.height
  if (isOrthographicCamera(state.camera)) {
    if (!state.camera.manual) {
      if (
        state.camera.left !== width / -2 ||
        state.camera.right !== width / 2 ||
        state.camera.top !== height / 2 ||
        state.camera.bottom !== height / -2
      ) {
        Object.assign(state.camera, {
          left: width / -2,
          right: width / 2,
          top: height / 2,
          bottom: height / -2,
        })
        state.camera.updateProjectionMatrix()
      }
    } else {
      state.camera.updateProjectionMatrix()
    }
  } else if (state.camera.aspect !== aspect) {
    state.camera.aspect = aspect
    state.camera.updateProjectionMatrix()
  }

  const autoClear = state.gl.autoClear
  state.gl.autoClear = false

  state.gl.setViewport(0, 0, canvasSize.width, canvasSize.height)
  state.camera.setViewOffset(
    width,
    height,
    -left,
    -top,
    canvasSize.width,
    canvasSize.height
  )

  const cl = getClampedPos(pos, canvasSize)
  if (cl.height) {
    state.gl.setScissor(cl.left, cl.top, cl.width, cl.height)
    state.gl.setScissorTest(true)
  }

  return autoClear
}

function getClampedPos(pos: DOMPosition, canvasSize: CanvasSize): DOMPosition {
  // scissor: values should be clamped to the canvas size, otherwise WebGPU will throw an error
  const { top, left, width, height, bottom, right } = pos

  const clampedTop = Math.max(0, top)
  const clampedHeight =
    top < 0
      ? Math.max(height + top, 0)
      : Math.max(Math.min(height, canvasSize.height - Math.abs(top) - 1), 0)
  const clampedLeft = Math.max(0, left)
  const clampedWidth = Math.max(
    0,
    Math.min(width, canvasSize.width - Math.abs(left) - 1)
  )

  return {
    top: clampedTop,
    left: clampedLeft,
    width: clampedWidth,
    height: clampedHeight,
    bottom,
    right,
  }
}

function clearArea(
  state: RootState,
  prevPos: DOMPosition,
  canvasSize: CanvasSize
) {
  // Clear the area of the previous viewport
  const { left, top, width, height } = getClampedPos(prevPos, canvasSize)
  if (height) {
    state.gl.setScissor(left, top, width, height)
    state.gl.setScissorTest(true)
    clear(state)
  }
}

function finishSkissor(state: RootState, autoClear: boolean) {
  // Restore the default state
  state.gl.setScissorTest(false)
  state.gl.autoClear = autoClear
}

function clear(state: RootState) {
  state.gl.getClearColor(col)
  state.gl.setClearColor(col, state.gl.getClearAlpha())
  state.gl.clear(true, true)
}

function Container({
  visible = true,
  canvasSize,
  scene,
  index,
  children,
  frames,
  rect,
  track,
  copyCanvas,
  onFirstRender,
}: ContainerProps) {
  const rootState = useThree() as unknown as RootState
  const [isOffscreen, setOffscreen] = React.useState(false)
  let frameCount = 0
  const hasRendered = React.useRef(false)
  const prevPos = React.useRef<DOMPosition | null>(null)
  useFrame((_state) => {
    const state = _state as unknown as RootState
    const autoClear = state.gl.autoClear
    if (frames === Infinity || frameCount <= frames) {
      if (track) rect.current = track.current?.getBoundingClientRect()
      frameCount++
    }
    if (rect.current) {
      const { position, isOffscreen: _isOffscreen } = computeContainerPosition(
        canvasSize,
        rect.current
      )
      if (isOffscreen !== _isOffscreen) setOffscreen(_isOffscreen)
      if (visible && !_isOffscreen && rect.current) {
        // console.log("rendering", index)
        if (prevPos.current) {
          // with WebGPU we need to clear the previous position
          clearArea(state, prevPos.current, canvasSize)
        }
        prepareSkissor(state, position, canvasSize)
        prevPos.current = position

        // When children are present render the portalled scene, otherwise the default scene
        state.gl.render(children ? state.scene : scene, state.camera)

        // render on (invisible) main canvas, then copy back to tracked view canvas for correct stacking context
        const targetCanvas = track?.current as HTMLCanvasElement
        const ctx = targetCanvas?.getContext("2d")
        if (copyCanvas && ctx) {
          // TODO: find a more performant solution
          const sourceCanvas = state.gl.domElement as HTMLCanvasElement
          const dpr = state.gl.getPixelRatio()
          const viewWidth = Math.round(position.width * dpr)
          const viewHeight = Math.round(position.height * dpr)
          if (
            targetCanvas.width !== viewWidth ||
            targetCanvas.height !== viewHeight
          ) {
            targetCanvas.width = viewWidth
            targetCanvas.height = viewHeight
          } else ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height)
          ctx.drawImage(
            sourceCanvas,
            Math.round(position.left * dpr),
            Math.round(position.top * dpr),
            viewWidth,
            viewHeight,
            0,
            0,
            viewWidth,
            viewHeight
          )
        }

        finishSkissor(state, autoClear)

        if (!hasRendered.current && onFirstRender) {
          hasRendered.current = true
          onFirstRender()
        }
      }
    }
  }, index)

  React.useLayoutEffect(() => {
    const curRect = rect.current
    if (curRect && (!visible || !isOffscreen)) {
      // If the view is not visible clear it once, but stop rendering afterwards!
      const { position } = computeContainerPosition(canvasSize, curRect)
      const autoClear = prepareSkissor(rootState, position, canvasSize)
      clear(rootState)
      finishSkissor(rootState, autoClear)
    }
  }, [visible, isOffscreen])

  React.useEffect(() => {
    if (!track) return

    const curRect = rect.current
    // Connect the event layer to the tracking element
    const old = rootState.get().events.connected
    rootState.setEvents({ connected: track.current })
    return () => {
      if (curRect) {
        const { position } = computeContainerPosition(canvasSize, curRect)
        const autoClear = prepareSkissor(rootState, position, canvasSize)
        clear(rootState)
        finishSkissor(rootState, autoClear)
      }
      rootState.setEvents({ connected: old })
    }
  }, [track])

  return (
    <>
      {children}
      {/** Without an element that receives pointer events state.pointer will always be 0/0 */}
      <group onPointerOver={() => null} />
    </>
  )
}

const CanvasView = /* @__PURE__ */ React.forwardRef(function CanvasView(
  {
    track,
    visible = true,
    index = 1,
    id, // eslint-disable-line @typescript-eslint/no-unused-vars
    style, // eslint-disable-line @typescript-eslint/no-unused-vars
    className, // eslint-disable-line @typescript-eslint/no-unused-vars
    frames = Infinity,
    children,
    copyCanvas,
    onFirstRender,
    ...props
  }: ViewProps,
  fref: React.ForwardedRef<THREE.Group>
) {
  const rect = React.useRef<DOMRect>(null!)
  const { size, scene } = useThree()
  const [virtualScene] = React.useState(() => new THREE.Scene())
  const [ready, toggle] = React.useReducer(() => true, false)

  const compute: ComputeFunction = React.useCallback(
    (event, state) => {
      if (
        rect.current &&
        track &&
        track.current &&
        event.target === track.current
      ) {
        const { width, height, left, top } = rect.current
        const x = event.clientX - left
        const y = event.clientY - top
        state.pointer.set((x / width) * 2 - 1, -(y / height) * 2 + 1)
        state.raycaster.setFromCamera(state.pointer, state.camera)
      }
    },
    [rect, track]
  )

  React.useEffect(() => {
    // We need the tracking elements bounds beforehand in order to inject it into the portal
    if (track) rect.current = track.current?.getBoundingClientRect()
    // And now we can proceed
    toggle()
  }, [track])

  return (
    <group ref={fref} {...props}>
      {ready &&
        createPortal(
          <Container
            visible={visible}
            canvasSize={size}
            frames={frames}
            scene={scene}
            track={track}
            rect={rect}
            index={index}
            copyCanvas={copyCanvas}
            onFirstRender={onFirstRender}
          >
            {children}
          </Container>,
          virtualScene,
          {
            events: { compute, priority: index },
            size: {
              width: rect.current?.width,
              height: rect.current?.height,
              top: rect.current?.top,
              left: rect.current?.left,
            },
          }
        )}
    </group>
  )
})

const HtmlView = /* @__PURE__ */ React.forwardRef(function HtmlView(
  {
    as: El = "canvas", // div -> canvas
    id,
    visible,
    className,
    style,
    index = 1,
    // track,
    frames = Infinity,
    children,
    copyCanvas,
    onFirstRender,
    ...props
  }: ViewProps,
  fref: React.ForwardedRef<HTMLElement>
) {
  const uuid = React.useId()
  const ref = React.useRef<HTMLElement>(null!)
  React.useImperativeHandle(fref, () => ref.current)
  return (
    <>
      {/** @ts-expect-error with ref */}
      <El ref={ref} id={id} className={className} style={style} {...props} />
      <tracked.In>
        <CanvasView
          visible={visible}
          key={uuid}
          track={ref}
          frames={frames}
          index={index}
          copyCanvas={copyCanvas}
          onFirstRender={onFirstRender}
        >
          {children}
        </CanvasView>
      </tracked.In>
    </>
  )
})

export type ViewportProps = {
  Port: () => React.JSX.Element
} & React.ForwardRefExoticComponent<
  ViewProps & React.RefAttributes<HTMLElement | THREE.Group>
>

export const View = /* @__PURE__ */ (() => {
  const _View = React.forwardRef(function View_(
    props: ViewProps,
    fref: React.ForwardedRef<HTMLElement | THREE.Group>
  ) {
    // If we're inside a canvas we should be able to access the context store
    const store = React.useContext(context)
    // If that's not the case we render a tunnel
    if (!store)
      return (
        <HtmlView
          ref={fref as unknown as React.ForwardedRef<HTMLElement>}
          {...props}
        />
      )
    // Otherwise a plain canvas-view
    else
      return (
        <CanvasView
          ref={fref as unknown as React.ForwardedRef<THREE.Group>}
          {...props}
        />
      )
  }) as ViewportProps

  _View.Port = function ViewPortal() {
    return <tracked.Out />
  }

  return _View
})()
