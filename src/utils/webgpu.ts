import { useEffect } from "react"
import * as tf from "@tensorflow/tfjs"
import type * as THREE from "three/webgpu"
import { useThree } from "@react-three/fiber"
import { setStatus, useGlobalStore } from "@/store"
import type Backend from "three/src/renderers/common/Backend.js"

export function useGPUDevice() {
  const gpuDevice = useGlobalStore((s) => s.gpuDevice)
  const backendReady = useGlobalStore((s) => s.backendReady)
  useEffect(() => {
    if (!backendReady) return
    async function initGPU() {
      // share webgpu device between tfjs and threejs to allow direct GPU-to-GPU transfer
      const webGpuBackend = tf.engine().registry.webgpu
      const newGpuDevice =
        !!webGpuBackend && "device" in webGpuBackend
          ? (webGpuBackend.device as GPUDevice)
          : undefined
      useGlobalStore.setState({ gpuDevice: newGpuDevice })
      // e.g. out of memory (LoRA training): tfjs and three.js can't continue without a new device
      newGpuDevice?.lost.then((info) => {
        console.error("WebGPU device lost:", info.reason, info.message)
        if (info.reason === "destroyed") return // destroyed on purpose
        const title = "GPU device lost (out of memory?)"
        const opts = { id: "gpu_device_lost", permanent: true } // id: registered by each useGPUDevice
        setStatus({ title, data: { "": "Please reload the page." } }, null, opts)
      })
    }
    initGPU()
  }, [backendReady])
  return gpuDevice
}

interface TypedWebGPUBackend extends Backend {
  device: GPUDevice
  data: WeakMap<THREE.StorageBufferAttribute, { buffer: GPUBuffer }> // actually there are more types for K and V
  get: (obj: THREE.StorageBufferAttribute) => { buffer: GPUBuffer } | undefined
}

export function isWebGPUBackend(backend: Backend): backend is TypedWebGPUBackend {
  return "isWebGPUBackend" in backend && (backend.isWebGPUBackend as boolean)
}

export function useBackend() {
  return useThree((s) => s.gl as unknown as THREE.WebGPURenderer).backend
}

export function useIsWebGPU() {
  const backend = useBackend()
  return isWebGPUBackend(backend)
}
