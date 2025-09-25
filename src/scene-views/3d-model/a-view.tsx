import React, { useEffect, useId, useRef, useState } from "react"
import * as THREE from "three/webgpu"
import tunnel from "tunnel-rat"
import { useFrame, createPortal } from "@react-three/fiber"
import type { RootState as RootStateGL } from "@react-three/fiber"

export const Tunnel = tunnel()

export type RootState = RootStateGL & {
  gl: THREE.WebGPURenderer & {
    setCanvasTarget: (target: THREE.CanvasTarget) => void
  }
}

interface AViewProps {
  className?: string
  children?: React.ReactNode
}

export const AView = ({ className = "", children }: AViewProps) => {
  const ref = useRef<HTMLCanvasElement>(null)
  const uuid = useId()
  return (
    <canvas ref={ref} className={`${className} border-1 border-marker`}>
      <Tunnel.In>
        <ViewInner canvasRef={ref} key={uuid}>
          {children}
        </ViewInner>
      </Tunnel.In>
    </canvas>
  )
}

interface ViewInnerProps {
  children: React.ReactNode
  canvasRef: React.RefObject<HTMLCanvasElement | null>
}

const ViewInner = ({ children, canvasRef }: ViewInnerProps) => {
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
