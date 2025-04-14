import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import * as tf from "@tensorflow/tfjs"
import { getThreadsCount } from "@tensorflow/tfjs-backend-wasm"
import { useGlobalStore, isDebug, setStatus, getThree, getScene } from "@/store"
import { getAvailableBackends, type Backend } from "@/model/tf-backend"
import { useKeyCommand } from "./key-command"

export function useDebugCommands() {
  useKeyCommand("d", toggleDebug)
  useKeyCommand("b", switchBackend)
  useKeyCommand("s", showStats)
}

function toggleDebug() {
  useGlobalStore.setState({ isDebug: !isDebug() })
  setStatus(`Debug mode ${isDebug() ? "enabled" : "disabled"}`)
}

function switchBackend() {
  const currentBackend = tf.getBackend() as Backend
  const availableBackends = getAvailableBackends()
  const currIdx = availableBackends.indexOf(currentBackend)
  const newBackend = availableBackends[(currIdx + 1) % availableBackends.length]
  tf.setBackend(newBackend)
  setStatus(`Switched backend to ${newBackend}`)
}

function showStats() {
  const gl = getThree()?.gl

  const memoryInfo = tf.memory() as tf.MemoryInfo & {
    numBytesInGPU: number
    numBytesInGPUAllocated: number
    numBytesInGPUFree: number
  }
  const gpuBytes = memoryInfo.numBytesInGPU
  const data = {
    Backend: tf.getBackend(),
    Memory: `${(memoryInfo.numBytes / 1024 / 1024).toFixed(2)} MB`,
    GPU: gpuBytes
      ? `${(memoryInfo.numBytesInGPU / 1024 / 1024).toFixed(2)} MB`
      : undefined,
    Tensors: memoryInfo.numTensors,
    Geometries: gl?.info.memory.geometries,
  }
  setStatus({ data })

  const appState = useGlobalStore.getState()
  const scene = getScene().getState()
  const glInfo = gl?.info
  const tfEngine = tf.engine()
  const tfVars = tfEngine.state.registeredVariables
  const wasmThreads = getThreadsCount()
  console.log({ appState, scene, glInfo, tfEngine, tfVars, wasmThreads })
}

export function useScreenshotBodyClass() {
  const searchParams = useSearchParams()
  const isScreenshot = typeof searchParams.get("screenshot") === "string"
  useEffect(() => {
    if (isScreenshot) document.body.classList.add("screenshot")
    return () => document.body.classList.remove("screenshot")
  }, [isScreenshot])
}
