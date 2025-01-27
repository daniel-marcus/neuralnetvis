import { useStatusText } from "@/components/status-text"
import { useEffect } from "react"
import { create } from "zustand"
import * as tf from "@tensorflow/tfjs"

export const useDebugStore = create<{
  debug: boolean
  toggleDebug: () => void
}>((set) => ({
  debug: false,
  toggleDebug: () => set((s) => ({ debug: !s.debug })),
}))

export const debug = () => useDebugStore.getState().debug

export function useDebug() {
  const debug = useDebugStore((s) => s.debug)
  const toggleDebug = useDebugStore((s) => s.toggleDebug)
  const setStatusText = useStatusText((s) => s.setStatusText)

  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === "d") {
        toggleDebug()
        const debug = useDebugStore.getState().debug
        setStatusText(`Debug mode ${debug ? "enabled" : "disabled"}`)
        if (debug) tf.enableDebugMode()
      }
      if (e.key === "s") {
        const memoryInfo = tf.memory() as tf.MemoryInfo & {
          numBytesInGPU: number
          numBytesInGPUAllocated: number
          numBytesInGPUFree: number
        }
        const statusText = `
Backend: ${tf.getBackend()}<br/>
Memory: ${(memoryInfo.numBytes / 1024 / 1024).toFixed(2)} MB<br/>
In GPU: ${(memoryInfo.numBytesInGPU / 1024 / 1024).toFixed(2)} MB<br/>
Tensors: ${memoryInfo.numTensors} / Data Buffers: ${
          memoryInfo.numDataBuffers
        }<br/>
      `
        setStatusText(statusText)
        console.log(statusText.replaceAll("<br/>", ""), { memoryInfo })
        const engine = tf.engine()
        console.log({ engine })
      }
    }
    window.addEventListener("keydown", onKeydown)
    return () => {
      window.removeEventListener("keydown", onKeydown)
    }
  }, [setStatusText, toggleDebug])

  return debug
}
