import { useEffect } from "react"
import * as tf from "@tensorflow/tfjs"
import "@tensorflow/tfjs-backend-webgpu"
import "@tensorflow/tfjs-backend-wasm"
import { setWasmPaths } from "@tensorflow/tfjs-backend-wasm"
import { getModel, useGlobalStore } from "@/store"

setWasmPaths({
  "tfjs-backend-wasm.wasm": "/tfjs-backend-wasm.wasm",
  "tfjs-backend-wasm-simd.wasm": "/tfjs-backend-wasm-simd.wasm",
  "tfjs-backend-wasm-threaded-simd.wasm":
    "/tfjs-backend-wasm-threaded-simd.wasm",
})

export const DEFAULT_BACKEND = "wasm" // "webgpu" | "wasm" | "webgl"

export function useTfBackend() {
  const backendReady = useGlobalStore((s) => s.backendReady)
  useEffect(() => {
    async function checkReady() {
      // console.log(getAvailableBackends())
      await setBackendIfAvailable(DEFAULT_BACKEND)
      useGlobalStore.setState({ backendReady: true })
    }
    checkReady()
  }, [])
  return backendReady
}

export async function setBackendIfAvailable(_backend?: string) {
  const backend = _backend || DEFAULT_BACKEND
  if (!getAvailableBackends().includes(backend)) return
  const success = await tf.setBackend(backend)
  if (!success) {
    console.warn(`Failed to set backend: ${backend}`)
    await tf.setBackend(DEFAULT_BACKEND)
  }
}

export function getAvailableBackends() {
  // sort backends by priority: [webgpu, webgl, cpu]
  return Object.entries(tf.engine().registryFactory)
    .sort(([, a], [, b]) => b.priority - a.priority)
    .map(([name]) => name)
}

export async function backendForTraining() {
  const backends = getAvailableBackends()
  const model = getModel()
  const silent = useGlobalStore.getState().trainConfig.silent
  const totalSamples = useGlobalStore.getState().totalSamples()
  if (silent && backends.includes("webgpu") && totalSamples > 1000) {
    await setBackendIfAvailable("webgpu") // fastest for silent, only in Chrome
  } else if (model?.layers.find((l) => l.getClassName() === "Conv2D")) {
    await setBackendIfAvailable("webgl") // Conv2D is not yet supported by wasm
  }
}
