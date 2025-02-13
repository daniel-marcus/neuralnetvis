import { create } from "zustand"
import * as tf from "@tensorflow/tfjs"
import { useStatusStore } from "@/components/status"
import { getAvailableBackends } from "@/model/tf-backend"
import { useThreeStore } from "@/scene/three-store"
import { useKeyCommand } from "./utils"

interface DebugStore {
  debug: boolean
  toggleDebug: () => void
}

export const useDebugStore = create<DebugStore>((set) => ({
  debug: false,
  toggleDebug: () => set((s) => ({ debug: !s.debug })),
}))

export const debug = () => useDebugStore.getState().debug

export function useDebugCommands() {
  useKeyCommand("d", toggleDebug)
  useKeyCommand("b", switchBackend)
  useKeyCommand("s", showStats)
}

const { setStatusText } = useStatusStore.getState()

function toggleDebug() {
  useDebugStore.getState().toggleDebug()
  const debug = useDebugStore.getState().debug
  setStatusText(`Debug mode ${debug ? "enabled" : "disabled"}`)
  // if (debug) tf.enableDebugMode()
}

function switchBackend() {
  const currentBackend = tf.getBackend()
  const availableBackends = getAvailableBackends()
  const currIdx = availableBackends.indexOf(currentBackend)
  const newBackend = availableBackends[(currIdx + 1) % availableBackends.length]
  tf.setBackend(newBackend)
  setStatusText(`Switched backend to ${newBackend}`)
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
  setStatusText({ data })

  const tfEngine = tf.engine()
  const glInfo = gl?.info
  console.log(data, { tfEngine, glInfo })
}
