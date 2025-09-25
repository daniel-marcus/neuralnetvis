import React, { useEffect, useId, useRef, useState } from "react"
import { CanvasTarget, Scene } from "three/webgpu"
import { useFrame, createPortal } from "@react-three/fiber"
import { Tunnel, type RootState } from "@/components/main-canvas"

// inspirations:
// - https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_multiple_canvas.html
// - https://github.com/pmndrs/drei/blob/master/src/web/View.tsx
// works only with WebGPUBackend

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
  return (
    <canvas ref={canvasRef} className={`${className}`}>
      <Tunnel.In>
        <CanvasTargetInner key={uuid} canvasRef={canvasRef} {...otherProps} />
      </Tunnel.In>
    </canvas>
  )
}

interface CanvasTargetInnerProps extends CanvasTargetViewProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
}

function CanvasTargetInner(props: CanvasTargetInnerProps) {
  const { canvasRef, children, onFirstRender, ...otherProps } = props
  const [canvasTarget, setCanvasTarget] = useState<CanvasTarget | null>(null)
  const [virtualScene] = useState(() => new Scene())

  useEffect(() => {
    if (!canvasRef.current) return
    const newTarget = new CanvasTarget(canvasRef.current, {
      antialias: true,
    })
    const { width, height } = canvasRef.current.getBoundingClientRect()
    newTarget.setPixelRatio(window.devicePixelRatio)
    newTarget.setSize(width, height, false)
    virtualScene.userData["canvasTarget"] = newTarget
    setCanvasTarget(newTarget)
    onFirstRender?.()
  }, [canvasRef])

  return (
    !!canvasTarget &&
    createPortal(
      <Container canvasTarget={canvasTarget} {...otherProps}>
        {children}
      </Container>,
      virtualScene
    )
  )
}

interface ContainerProps {
  children: React.ReactNode
  canvasTarget: CanvasTarget
  visible?: boolean
  index?: number
}

const Container = (props: ContainerProps) => {
  const { children, canvasTarget, visible = true, index } = props
  useFrame((_state) => {
    const state = _state as unknown as RootState
    if (visible) {
      // console.log("RENDER", index)
      state.gl.setCanvasTarget(canvasTarget)
      state.gl.render(state.scene, state.camera)
    }
  }, index)
  return <>{children}</>
}
