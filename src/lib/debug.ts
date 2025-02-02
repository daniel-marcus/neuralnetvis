import { useStatusText } from "@/components/status"
import { useEffect } from "react"
import { create } from "zustand"
import * as tf from "@tensorflow/tfjs"
import { useThree } from "@react-three/fiber"

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
  const { gl } = useThree()
  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName.toLowerCase() === "input") return
      if (e.key === "d") {
        toggleDebug()
        const debug = useDebugStore.getState().debug
        setStatusText(`Debug mode ${debug ? "enabled" : "disabled"}`)
        // if (debug) tf.enableDebugMode()
      }
      if (e.key === "s") {
        // stats
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
          Geometries: gl.info.memory.geometries,
        }
        setStatusText({ data })

        const tfEngine = tf.engine()
        const glInfo = gl.info
        console.log(data, { tfEngine, glInfo })
      }
    }
    window.addEventListener("keydown", onKeydown)
    return () => {
      window.removeEventListener("keydown", onKeydown)
    }
  }, [setStatusText, toggleDebug, gl])

  return debug
}
