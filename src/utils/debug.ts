import * as tf from "@tensorflow/tfjs"
import { useStore, isDebug, setStatus, getThree } from "@/store"
import { getAvailableBackends } from "@/model/tf-backend"
import { useKeyCommand } from "./key-command"

export function useDebugCommands() {
  useKeyCommand("d", toggleDebug)
  useKeyCommand("b", switchBackend)
  useKeyCommand("s", showStats)
}

function toggleDebug() {
  useStore.getState().toggleDebug()
  setStatus(`Debug mode ${isDebug() ? "enabled" : "disabled"}`)
}

function switchBackend() {
  const currentBackend = tf.getBackend()
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
  const data = {
    Backend: tf.getBackend(),
    Memory: `${(memoryInfo.numBytes / 1024 / 1024).toFixed(2)} MB`,
    GPU: `${(memoryInfo.numBytesInGPU / 1024 / 1024).toFixed(2)} MB`,
    Tensors: memoryInfo.numTensors,
    Geometries: gl?.info.memory.geometries,
  }
  setStatus({ data })

  const tfEngine = tf.engine()
  const glInfo = gl?.info
  const appState = useStore.getState()
  console.log({ data, tfEngine, glInfo, appState })
}
