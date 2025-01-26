import { useControls } from "leva"
import { Dataset, numColorChannels } from "./datasets"
import { createContext, useEffect } from "react"
import { useDebug } from "./_debug"
import { useStatusText } from "@/components/status-text"
import * as tf from "@tensorflow/tfjs"

export type HighlightProp = "weights" | "weightedInputs"

interface UiOptions {
  showLines: boolean
  splitColors: boolean
  highlightProp: HighlightProp | string
}

const defaultOptions = {
  showLines: true,
  splitColors: false,
  highlightProp: "weights",
}

export const UiOptionsContext = createContext<UiOptions>(defaultOptions)

export function useUiOptions(ds?: Dataset) {
  const hasColorChannels = numColorChannels(ds) > 1
  const uiOptions: UiOptions = useControls(
    "ui",
    {
      showLines: defaultOptions.showLines,
      splitColors: {
        value: defaultOptions.splitColors,
        render: () => hasColorChannels,
      },
      highlightProp: {
        value: defaultOptions.highlightProp as HighlightProp,
        label: "onHover",
        options: {
          "show weights": "weights",
          "show weighted inputs": "weightedInputs",
        },
      },
    },
    { collapsed: true },
    [hasColorChannels]
  )

  const setStatusText = useStatusText((s) => s.setStatusText)

  const toggleDebug = useDebug((s) => s.toggleDebug)
  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === "d") {
        toggleDebug()
        const debug = useDebug.getState().debug
        setStatusText(`Debug mode ${debug ? "enabled" : "disabled"}`)
        if (debug) tf.enableDebugMode()
        else tf.enableProdMode()
      }
      if (e.key === "s") {
        const memoryInfo = tf.memory() as tf.MemoryInfo & {
          numBytesInGPU: number
          numBytesInGPUAllocated: number
          numBytesInGPUFree: number
        }
        const statusText = `
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

  return uiOptions
}
