import { useEffect, useState } from "react"
import * as tf from "@tensorflow/tfjs"
import "@tensorflow/tfjs-backend-webgpu"
import "@tensorflow/tfjs-backend-wasm"
import { setWasmPaths } from "@tensorflow/tfjs-backend-wasm"

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
      await (setBackendIfAvailable(DEFAULT_BACKEND) || tf.ready())
      setIsReady(true)
    }
    checkReady()
  }, [])
  return isReady
}

export async function setBackendIfAvailable(backend: string) {
  await tf.ready()
  return getAvailableBackends().includes(backend) && tf.setBackend(backend)
}

export function getAvailableBackends() {
  // sort backends by priority: [webgpu, webgl, cpu]
  return Object.entries(tf.engine().registryFactory)
    .sort(([, a], [, b]) => b.priority - a.priority)
    .map(([name]) => name)
}
