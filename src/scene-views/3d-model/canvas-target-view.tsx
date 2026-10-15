import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { CanvasTarget, Scene, Vector2 } from "three/webgpu"
import { useFrame, useThree, createPortal, type RootState as RootStateGL } from "@react-three/fiber"
import { Tunnel, type RootState } from "@/components/main-canvas-tunnel"
import { useInView } from "@/utils/screen"
import { applyViewOffset, setIsRendered } from "./utils"

// inspirations:
// - https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_multiple_canvas.html
// - https://github.com/pmndrs/drei/blob/master/src/web/View.tsx
// works only with WebGPUBackend

const MAX_DPR = 2

// keep GPU buffers only for canvases that are visible or within one screen distance
const NEAR_VIEW_OPTIONS = { rootMargin: "100% 0px" }

interface CanvasTargetViewProps {
  className?: string
  children?: React.ReactNode
  onFirstRender?: () => void
  visible?: boolean
  index?: number
}

export const CanvasTargetView = (props: CanvasTargetViewProps) => {
  const { className = "", ...otherProps } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const uuid = useId()
  const [, inView] = useInView(undefined, canvasRef)
  const [, nearView] = useInView(NEAR_VIEW_OPTIONS, canvasRef)
  return (
    <canvas ref={canvasRef} className={`${className}`}>
      <Tunnel.In>
        <CanvasTargetInner
          key={uuid}
          canvasRef={canvasRef}
          inView={inView}
          nearView={nearView}
          {...otherProps}
        />
      </Tunnel.In>
    </canvas>
  )
}

interface CanvasTargetInnerProps extends CanvasTargetViewProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  inView: boolean
  nearView: boolean
}

type Size = { width: number; height: number }

function CanvasTargetInner(props: CanvasTargetInnerProps) {
  const { canvasRef, children, onFirstRender, ...otherProps } = props
  const [canvasTarget, setCanvasTarget] = useState<CanvasTarget | null>(null)
  const [virtualScene] = useState(() => new Scene())

  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => {
    if (!canvasRef.current) return
    const newTarget = new CanvasTarget(canvasRef.current)
    const { width, height } = getCssSize(canvasRef.current.getBoundingClientRect())
    newTarget.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR))
    newTarget.setSize(width, height, false)
    virtualScene.userData["canvasTarget"] = newTarget // eslint-disable-line react-hooks/immutability
    setCanvasTarget(newTarget)
    onFirstRender?.()
    return () => {
      newTarget.dispose()
      virtualScene.userData["canvasTarget"] = null
    }
  }, [canvasRef, onFirstRender, virtualScene])

  return (
    !!canvasTarget &&
    createPortal(
      <Container canvasTarget={canvasTarget} {...otherProps}>
        {children}
      </Container>,
      virtualScene,
    )
  )
}

interface ContainerProps {
  children: React.ReactNode
  canvasTarget: CanvasTarget
  visible?: boolean
  index?: number
  inView: boolean
  nearView: boolean
}

const Container = (props: ContainerProps) => {
  const { children, canvasTarget, visible = true, index, inView, nearView } = props
  // parked: shrink to 1x1 and render once, so that three.js reallocates the canvas, depth and framebuffer textures
  // at minimal size and releases the large ones
  const isParked = !(visible && nearView)
  const shouldRender = visible && inView
  const cssSize = useRef<Size>(canvasTarget.getSize(new Vector2()))

  const renderTarget = (_state: RootStateGL) => {
    const state = _state as unknown as RootState
    setIsRendered(state, shouldRender)
    const { width, height } = isParked ? { width: 1, height: 1 } : cssSize.current
    if (!shouldRender && !(isParked && !hasSize(canvasTarget, width, height))) return
    // console.log("RENDER", index, inView)
    // set as current target first: the renderer only listens to resize events of the current target
    state.gl.setCanvasTarget(canvasTarget)
    if (!hasSize(canvasTarget, width, height)) canvasTarget.setSize(width, height, false)
    if (!isParked) applyViewOffset(state.camera, state.size.width, state.size.height, width, height)
    state.gl.render(state.scene, state.camera)
  }
  const renderTargetRef = useRef(renderTarget)
  useLayoutEffect(() => {
    renderTargetRef.current = renderTarget
  })

  const get = useThree((s) => s.get)
  useEffect(() => {
    get().invalidate()
  }, [isParked, inView, get])

  useEffect(() => {
    // ResizeObserver callbacks run after layout, but before paint: render right away, otherwise the browser would
    // show the old drawing buffer stretched to the new canvas size for a frame (e.g. on expand/collapse)
    const observer = new ResizeObserver(([entry]) => {
      cssSize.current = getCssSize(entry.contentRect)
      renderTargetRef.current(get())
    })
    observer.observe(canvasTarget.domElement as HTMLCanvasElement)
    return () => observer.disconnect()
  }, [canvasTarget, get])

  useFrame((state) => renderTargetRef.current(state), index)
  return <>{children}</>
}

// hidden canvases (display: none) report 0x0
function getCssSize({ width, height }: Size): Size {
  return { width: Math.max(width, 1), height: Math.max(height, 1) }
}

const _size = new Vector2()

function hasSize(canvasTarget: CanvasTarget, width: number, height: number) {
  const curr = canvasTarget.getSize(_size)
  return curr.width === width && curr.height === height
}
