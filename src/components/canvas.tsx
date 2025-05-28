import { useEffect, useRef } from "react"
import * as THREE from "three/webgpu"
import { Canvas, extend, useThree } from "@react-three/fiber"
import { useGPUDevice } from "@/utils/webgpu"
import { View } from "@/scene-views/3d-model/view"
import type { ThreeToJSXElements } from "@react-three/fiber"
import type { WebGPURendererParameters } from "three/src/renderers/webgpu/WebGPURenderer.js"

declare module "@react-three/fiber" {
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}

extend(THREE as any)

export function MainCanvas() {
  const ref = useRef<HTMLDivElement>(null!)
  const gpuDevice = useGPUDevice()
  if (typeof gpuDevice === null) return null // not initialized yet, if no WebGPU support it will become undefined (WebGL fallback)
  return (
    <div
      ref={ref}
      className="fixed top-0 left-0 w-screen h-screen pointer-events-none"
    >
      <Canvas
        frameloop="demand"
        eventSource={ref}
        gl={async (renderProps) => {
          const renderer = new THREE.WebGPURenderer({
            ...(renderProps as WebGPURendererParameters),
            device: gpuDevice ? gpuDevice : undefined,
            // forceWebGL: true,
          })
          await renderer.init()
          return renderer
        }}
      >
        <View.Port />
        <OnScrollInvalidate />
      </Canvas>
    </div>
  )
}

function OnScrollInvalidate() {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const onScroll = () => invalidate()
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [invalidate])
  return null
}
