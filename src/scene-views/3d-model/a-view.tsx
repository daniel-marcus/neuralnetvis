import React, { useEffect, useId, useRef, useState } from "react"
import * as THREE from "three/webgpu"
import tunnel from "tunnel-rat"
import { useFrame, createPortal } from "@react-three/fiber"
import type { RootState as RootStateGL } from "@react-three/fiber"

// inspirations:
// - https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_multiple_canvas.html
// - https://github.com/pmndrs/drei/blob/master/src/web/View.tsx

export const Tunnel = tunnel()

export type RootState = RootStateGL & {
  gl: THREE.WebGPURenderer & {
    setCanvasTarget: (target: THREE.CanvasTarget) => void
  }
}

interface AViewProps {
  className?: string
  children?: React.ReactNode
  onFirstRender?: () => void
}

export const AView = ({ className = "", ...otherProps }: AViewProps) => {
  const ref = useRef<HTMLCanvasElement>(null)
  const uuid = useId()
  return (
    <canvas ref={ref} className={`${className}`}>
      <Tunnel.In>
        <ViewInner canvasRef={ref} key={uuid} {...otherProps} />
      </Tunnel.In>
    </canvas>
  )
}

interface ViewInnerProps {
  children?: React.ReactNode
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  onFirstRender?: () => void
}

const ViewInner = ({ children, canvasRef, onFirstRender }: ViewInnerProps) => {
  const [target, setTarget] = useState<THREE.CanvasTarget | null>(null)
  const [virtualScene] = useState(() => new THREE.Scene())
  useEffect(() => {
    if (!canvasRef.current) return
    const newTarget = new THREE.CanvasTarget(canvasRef.current, {
      antialias: true,
    })
    newTarget.setPixelRatio(window.devicePixelRatio)
    newTarget.setSize(window.innerWidth, window.innerHeight)
    virtualScene.userData["canvasTarget"] = newTarget
    setTarget(newTarget)
    onFirstRender?.()
  }, [canvasRef])
  return (
    !!target &&
    createPortal(
      <Container target={target}>{children}</Container>,
      virtualScene,
      {
        size: {
          ...target.domElement.getBoundingClientRect(),
        },
      }
    )
  )
}

interface ContainerProps {
  children: React.ReactNode
  target: THREE.CanvasTarget
}

const Container = ({ children, target }: ContainerProps) => {
  useFrame((_state) => {
    const state = _state as unknown as RootState
    state.gl.setCanvasTarget(target)
    state.gl.render(state.scene, state.camera)
  })
  return (
    <>
      {children}
      <group onPointerOver={() => null} />
    </>
  )
}
