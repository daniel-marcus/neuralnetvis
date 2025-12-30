import React, { useEffect, useId, useRef, useState } from "react"
import { CanvasTarget, Scene } from "three/webgpu"
import { useFrame, createPortal } from "@react-three/fiber"
import { Tunnel, type RootState } from "@/components/main-canvas"
import { useInView } from "@/utils/screen"

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
  const [, inView] = useInView(undefined, canvasRef)
  return (
    <canvas ref={canvasRef} className={`${className}`}>
      <Tunnel.In>
        <CanvasTargetInner
          key={uuid}
          canvasRef={canvasRef}
          inView={inView}
          {...otherProps}
        />
      </Tunnel.In>
    </canvas>
  )
}

interface CanvasTargetInnerProps extends CanvasTargetViewProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  inView: boolean
}

function CanvasTargetInner(props: CanvasTargetInnerProps) {
  const { canvasRef, children, onFirstRender, ...otherProps } = props
  const [canvasTarget, setCanvasTarget] = useState<CanvasTarget | null>(null)
  const [virtualScene] = useState(() => new Scene())

  useEffect(() => {
    if (!canvasRef.current) return
    const newTarget = new CanvasTarget(canvasRef.current)
    const { width, height } = canvasRef.current.getBoundingClientRect()
    newTarget.setPixelRatio(window.devicePixelRatio)
    newTarget.setSize(width, height, false)
    virtualScene.userData["canvasTarget"] = newTarget // eslint-disable-line react-hooks/immutability
    setCanvasTarget(newTarget)
    onFirstRender?.()
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
}

const Container = (props: ContainerProps) => {
  const { children, canvasTarget, visible = true, index, inView } = props
  useFrame((_state) => {
    const state = _state as unknown as RootState
    if (visible && inView) {
      // console.log("RENDER", index, inView)
      state.gl.setCanvasTarget(canvasTarget)
      state.gl.render(state.scene, state.camera)
    }
  }, index)
  return <>{children}</>
}
