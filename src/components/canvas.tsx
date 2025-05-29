import { useEffect, useRef } from "react"
import * as THREE from "three/webgpu"
import { Canvas, extend, useFrame, useThree } from "@react-three/fiber"
import { useGPUDevice, isWebGPUBackend } from "@/utils/webgpu"
import { View, type RootState } from "@/scene-views/3d-model/view"
import type { ThreeToJSXElements } from "@react-three/fiber"
import type { WebGPURendererParameters } from "three/src/renderers/webgpu/WebGPURenderer.js"

declare module "@react-three/fiber" {
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}

extend(THREE as any)

export function MainCanvas() {
  const eventSource = useRef<HTMLDivElement>(null!)
  const gpuDevice = useGPUDevice()
  if (typeof gpuDevice === null) return null // not initialized yet, if no WebGPU support it will become undefined (WebGL fallback)
  return (
    <>
      <div ref={eventSource} className="fixed w-screen h-screen top-0" />
      <div className="absolute top-0 w-screen h-screen pointer-events-none">
        <Canvas
          frameloop="demand"
          eventSource={eventSource}
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
          <OnScrollUpdate />
        </Canvas>
      </div>
    </>
  )
}

function OnScrollUpdate() {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    // with frameloop="demand" we need to manually invalidate the scene on scroll
    const onScroll = () => invalidate()
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [invalidate])
  useFrame((_state) => {
    const state = _state as unknown as RootState
    if (isWebGPUBackend(state.gl.backend)) {
      // with WebGPU we need to clear the canvas manually
      const canvas = state.gl.domElement
      state.gl.setViewport(0, 0, canvas.width, canvas.height)
      state.gl.setScissorTest(false)
      state.gl.clear()
    }
    // translate the canvas wrapper to follow the scroll position (smoother than fixed position)
    // see: https://github.com/mrdoob/three.js/blob/master/examples/webgl_multiple_elements.html
    const wrapper = state.gl.domElement.parentElement?.parentElement
    if (wrapper) wrapper.style.transform = `translateY(${window.scrollY}px)`
  }, 0)
  return null
}
