import { useEffect, type RefObject } from "react"
import * as THREE from "three/webgpu"
import { Canvas, extend, useFrame, useThree } from "@react-three/fiber"
import { isWebGPUBackend, useGPUDevice } from "@/utils/webgpu"
import { View, type RootState } from "@/scene-views/3d-model/view"
import { useHasActiveTile } from "./tile-grid"
import type { ThreeToJSXElements } from "@react-three/fiber"
import type { WebGPURendererParameters } from "three/src/renderers/webgpu/WebGPURenderer.js"

declare module "@react-three/fiber" {
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}

extend(THREE as any)

interface MainCanvasProps {
  eventSource: RefObject<HTMLDivElement>
}

export function MainCanvas({ eventSource }: MainCanvasProps) {
  const gpuDevice = useGPUDevice()
  const hasActive = useHasActiveTile()
  if (typeof gpuDevice === null) return null // not initialized yet, if no WebGPU support it will become undefined (WebGL fallback)
  return (
    <>
      <div
        className={`${
          hasActive ? "fixed" : "absolute"
        } top-0 w-screen h-screen pointer-events-none! _opacity-0`}
      >
        <Canvas
          frameloop="demand"
          eventSource={eventSource}
          // className="border-1 border-marker"
          gl={async (renderProps) => {
            const renderer = new THREE.WebGPURenderer({
              ...(renderProps as WebGPURendererParameters),
              device: gpuDevice ? gpuDevice : undefined,
              // logarithmicDepthBuffer: true, // helps with color channel z-fighing, but bad for lines
              // forceWebGL: true,
            })
            await renderer.init()
            return renderer
          }}
        >
          <View.Port />
          <OnScrollUpdate sync={!hasActive} />
        </Canvas>
      </div>
    </>
  )
}

function OnScrollUpdate({ sync }: { sync?: boolean }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    // with frameloop="demand" we need to manually invalidate the scene on scroll
    if (!sync) return
    const onScroll = () => invalidate() // throttle(() => invalidate(), 30, { leading: true })
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [invalidate, sync])
  useFrame((_state) => {
    const state = _state as unknown as RootState
    if (isWebGPUBackend(state.gl.backend)) {
      // WebGPU: clear root before rendering views; WebGL: clear views separately
      state.gl.clear()
    }
    // translate the canvas wrapper to follow the scroll position (smoother than fixed position)
    // see: https://github.com/mrdoob/three.js/blob/master/examples/webgl_multiple_elements.html
    const wrapper = state.gl.domElement.parentElement?.parentElement
    const wrapperY = sync ? window.scrollY : 0
    if (wrapper) wrapper.style.transform = `translateY(${wrapperY}px)`
  }, 0)
  return null
}
