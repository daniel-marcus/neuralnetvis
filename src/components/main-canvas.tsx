import { useEffect, type RefObject } from "react"
import throttle from "lodash.throttle"
import * as THREE from "three/webgpu"
import { Canvas, extend, useFrame, useThree } from "@react-three/fiber"
import tunnel from "tunnel-rat"
import { isWebGPUBackend, useGPUDevice, useIsWebGPU } from "@/utils/webgpu"
import { useHasActiveTile } from "./tile-grid"
import { useGlobalStore } from "@/store"
import type { RootState as RootStateGL } from "@react-three/fiber"
import type { ThreeToJSXElements } from "@react-three/fiber"
import type { WebGPURendererParameters } from "three/src/renderers/webgpu/WebGPURenderer.js"

declare module "@react-three/fiber" {
  interface ThreeElements extends Omit<ThreeToJSXElements<typeof THREE>, "pMREMGenerator"> {} // eslint-disable-line @typescript-eslint/no-empty-object-type
}

extend(THREE as any) // eslint-disable-line @typescript-eslint/no-explicit-any

export const Tunnel = tunnel()

export type RootState = Omit<RootStateGL, "gl"> & {
  gl: THREE.WebGPURenderer & {
    setCanvasTarget: (target: THREE.CanvasTarget) => void
  }
}

interface MainCanvasProps {
  eventSource: RefObject<HTMLDivElement | null>
}

export function MainCanvas({ eventSource }: MainCanvasProps) {
  const gpuDevice = useGPUDevice()
  const hasActive = useHasActiveTile()
  if (gpuDevice === null) return null // not initialized yet, if no WebGPU support it will become undefined (WebGL fallback)
  return (
    <>
      <div
        className={`${
          hasActive ? "fixed" : "absolute"
        } top-0 w-screen h-screen pointer-events-none!`}
      >
        <Canvas
          frameloop="demand"
          eventSource={eventSource.current || undefined}
          // className="border-1 border-marker"
          gl={async (renderProps) => {
            const renderer = new THREE.WebGPURenderer({
              ...(renderProps as WebGPURendererParameters),
              device: gpuDevice ? gpuDevice : undefined,
              // logarithmicDepthBuffer: true, // helps with color channel z-fighing, but bad for lines
              // forceWebGL: true,
            })
            await renderer.init()
            useGlobalStore.setState({ renderer })
            return renderer
          }}
        >
          <Tunnel.Out />
          <OnScrollUpdate sync={!hasActive} />
        </Canvas>
      </div>
    </>
  )
}

/**
 * Only used for WebGLBackend legacy support!
 * Moves and updates the fixed main rendering canvas during scroll
 */

function OnScrollUpdate({ sync }: { sync: boolean }) {
  const invalidate = useThree((s) => s.invalidate)
  const isWebGPU = useIsWebGPU()
  const active = sync && !isWebGPU
  useEffect(() => {
    // with frameloop="demand" we need to manually invalidate the scene on scroll
    if (!active) return
    const onScroll = throttle(() => invalidate(), 30, { leading: true })
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [invalidate, active])
  useFrame((_state) => {
    if (isWebGPU) return
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
