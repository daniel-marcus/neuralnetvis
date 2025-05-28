import * as React from "react"
import * as THREE from "three/webgpu"
import { context, createPortal, useFrame, useThree } from "@react-three/fiber"
import tunnel from "tunnel-rat"
import type { ComputeFunction, RootState } from "@react-three/fiber"

// drei/View component adapted for WebGPURenderer
// original: https://github.com/pmndrs/drei/blob/master/src/web/View.tsx

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
    // switched top and bottom
    position: { width, height, left, top: bottom, bottom: top, right },
    isOffscreen,
  }
}

function prepareViewport(
  state: RootState,
  {
    left,
    bottom,
    width,
    height,
  }: {
    width: number
    height: number
    top: number
    left: number
    bottom: number
    right: number
  }
): { autoClear: boolean; originalViewport?: THREE.Vector4 } {
  const aspect = width / height

  // Update camera projection
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

  // WebGPU renderer handling
  const autoClear = state.gl.autoClear
  state.gl.autoClear = false

  // Store original viewport for restoration
  const originalViewport = new THREE.Vector4()
  state.gl.getViewport(originalViewport)

  // Set new viewport - use bottom coordinate for WebGL/WebGPU coordinate system
  state.gl.setViewport(left, bottom, width, height)

  return { autoClear, originalViewport }
}

function finishViewport(
  state: RootState,
  autoClear: boolean,
  originalViewport?: THREE.Vector4
) {
  state.gl.autoClear = autoClear
  if (originalViewport) {
    state.gl.setViewport(
      originalViewport.x,
      originalViewport.y,
      originalViewport.z,
      originalViewport.w
    )
  }
}

function clear(state: RootState) {
  state.gl.getClearColor(col)
  state.gl.setClearColor(col, state.gl.getClearAlpha())
  state.gl.clear()
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
}: ContainerProps) {
  const rootState = useThree()
  const [isOffscreen, setOffscreen] = React.useState(false)

  let frameCount = 0
  useFrame((state) => {
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
      if (visible && !isOffscreen && rect.current) {
        const { autoClear, originalViewport } = prepareViewport(state, position)

        // For WebGPU, we need to clear the viewport area before rendering
        clear(state)

        // When children are present render the portalled scene, otherwise the default scene
        state.gl.render(children ? state.scene : scene, state.camera)
        finishViewport(state, autoClear, originalViewport)
      }
    }
  }, index)

  React.useLayoutEffect(() => {
    const curRect = rect.current
    if (curRect && (!visible || !isOffscreen)) {
      // If the view is not visible clear it once, but stop rendering afterwards!
      const { position } = computeContainerPosition(canvasSize, curRect)
      const { autoClear, originalViewport } = prepareViewport(
        rootState,
        position
      )
      clear(rootState)
      finishViewport(rootState, autoClear, originalViewport)
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
        const { autoClear, originalViewport } = prepareViewport(
          rootState,
          position
        )
        clear(rootState)
        finishViewport(rootState, autoClear, originalViewport)
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
    as: El = "div",
    id,
    visible,
    className,
    style,
    index = 1,
    // track,
    frames = Infinity,
    children,
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

  _View.Port = function _ViewPort() {
    return <tracked.Out />
  }

  return _View
})()
