import { useEffect } from "react"
import * as tf from "@tensorflow/tfjs"
import "@tensorflow/tfjs-backend-webgpu"
import "@tensorflow/tfjs-backend-wasm"
import { setWasmPaths } from "@tensorflow/tfjs-backend-wasm"
import { getModel, useGlobalStore } from "@/store"

setWasmPaths("/wasm/")

export type Backend = "webgpu" | "wasm" | "webgl" | "cpu"

export const DEFAULT_BACKEND: Backend = "webgpu"
const FALLBACK_BACKEND: Backend = "wasm"

export function useTfBackend() {
  const backendReady = useGlobalStore((s) => s.backendReady)
  useEffect(() => {
    async function checkReady() {
      await setBackend(DEFAULT_BACKEND)
      useGlobalStore.setState({ backendReady: true })
    }
    checkReady()
  }, [])
  return backendReady
}

export async function setBackend(
  backend: Backend = DEFAULT_BACKEND,
  fallback: Backend = FALLBACK_BACKEND
) {
  const success = getAvailableBackends().includes(backend)
    ? await tf.setBackend(backend)
    : await tf.setBackend(fallback)
  if (!success) console.warn(`Failed to set backend: ${backend}`)
  return success
}

export function getAvailableBackends() {
  // sort backends by priority: [webgpu, webgl, wasm, cpu]
  return Object.entries(tf.engine().registryFactory)
    .sort(([, a], [, b]) => b.priority - a.priority)
    .map(([name]) => name as Backend)
}

export async function backendForTraining() {
  const backends = getAvailableBackends()
  const model = getModel()
  const scene = useGlobalStore.getState().scene
  const silent = scene.getState().trainConfig.silent
  const totalSamples = scene.getState().totalSamples()
  if (silent && backends.includes("webgpu") && totalSamples > 1000) {
    await setBackend("webgpu") // fastest for silent, only in Chrome
  } else if (model?.layers.find((l) => l.getClassName() === "Conv2D")) {
    await setBackend("webgl") // Conv2D is not yet supported by wasm
  }
}
