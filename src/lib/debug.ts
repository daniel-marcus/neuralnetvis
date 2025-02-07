import { setStatus } from "@/components/status"
import { create } from "zustand"
import * as tf from "@tensorflow/tfjs"
import { getAvailableBackends } from "./tf-backend"
import { useKeyCommand } from "./utils"
import { useThreeStore } from "@/three/three-store"

export const useDebugStore = create<{
  debug: boolean
  toggleDebug: () => void
}>((set) => ({
  debug: false,
  toggleDebug: () => set((s) => ({ debug: !s.debug })),
}))

export const debug = () => useDebugStore.getState().debug

export function useDebug() {
  useKeyCommand("d", toggleDebug)
  useKeyCommand("b", switchBackend)
  useKeyCommand("s", showStats)
}

function toggleDebug() {
  useDebugStore.getState().toggleDebug()
  const debug = useDebugStore.getState().debug
  setStatus(`Debug mode ${debug ? "enabled" : "disabled"}`)
  // if (debug) tf.enableDebugMode()
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
  const gl = useThreeStore.getState().three?.gl

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
  console.log(data, { tfEngine, glInfo })
}
