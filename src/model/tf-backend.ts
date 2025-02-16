import { useEffect, useState } from "react"
import * as tf from "@tensorflow/tfjs"
import "@tensorflow/tfjs-backend-webgpu"
import "@tensorflow/tfjs-backend-wasm"
import { setWasmPaths } from "@tensorflow/tfjs-backend-wasm"
import { getModel, useStore } from "@/store"

setWasmPaths({
  "tfjs-backend-wasm.wasm": "/tfjs-backend-wasm.wasm",
  "tfjs-backend-wasm-simd.wasm": "/tfjs-backend-wasm-simd.wasm",
  "tfjs-backend-wasm-threaded-simd.wasm":
    "/tfjs-backend-wasm-threaded-simd.wasm",
})

export const DEFAULT_BACKEND = "wasm" // "webgpu" | "wasm" | "webgl"

export function useTfBackend() {
  const [isReady, setIsReady] = useState(false)
  useEffect(() => {
    async function checkReady() {
      console.log(getAvailableBackends())
      await setBackendIfAvailable(DEFAULT_BACKEND)
      setIsReady(true)
    }
    checkReady()
  }, [])
  return isReady
}

export async function setBackendIfAvailable(_backend?: string) {
  const backend = _backend || DEFAULT_BACKEND
  if (!getAvailableBackends().includes(backend)) return
  const success = await tf.setBackend(backend)
  if (!success) {
    console.warn(`Failed to set backend: ${backend}`)
    return tf.setBackend(DEFAULT_BACKEND)
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
  const silent = useStore.getState().trainConfig.silent
  if (silent && backends.includes("webgpu")) {
    await setBackendIfAvailable("webgpu") // fastest for silent, only in Chrome
  } else if (model?.layers.find((l) => l.getClassName() === "Conv2D")) {
    await setBackendIfAvailable("webgl") // Conv2D is not yet supported by wasm
  }
}
