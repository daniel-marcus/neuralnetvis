import { useControls } from "leva"
import { Dataset, numColorChannels } from "./datasets"
import { createContext } from "react"
import { useControlStores } from "@/components/controls"
import { useDebugStore } from "./debug"

export type HighlightProp = "weights" | "weightedInputs"

interface VisOptions {
  layerSpacing: number
  neuronSpacing: number
  splitColors: boolean
  highlightProp: HighlightProp | string
  showLines: boolean
  lineActivationThreshold: number
  allowDenseHoverLines: boolean
}

const defaultOptions = {
  layerSpacing: 11,
  neuronSpacing: 1.1,
  showLines: true,
  splitColors: false,
  highlightProp: "weightedInputs",
  lineActivationThreshold: 0.5,
  allowDenseHoverLines: false,
}

export const VisOptionsContext = createContext<VisOptions>(defaultOptions)

export function useVisOptions(ds?: Dataset) {
  const hasColorChannels = numColorChannels(ds) > 1
  const { modelConfigStore } = useControlStores()
  const debug = useDebugStore((s) => s.debug)
  const visOptions: VisOptions = useControls(
    "visualization",
    {
      layerSpacing: {
        label: "spacing",
        value: defaultOptions.layerSpacing,
        min: 1,
        max: 30,
        step: 1,
      },
      neuronSpacing: {
        value: defaultOptions.neuronSpacing,
        min: 1,
        max: 5,
        step: 0.01,
        render: () => debug,
      },
      showLines: defaultOptions.showLines,
      lineActivationThreshold: {
        value: defaultOptions.lineActivationThreshold,
        min: 0,
        max: 1,
        step: 0.01,
        render: () => debug,
      },
      allowDenseHoverLines: {
        value: defaultOptions.allowDenseHoverLines,
        render: () => debug,
      },
      splitColors: {
        value: defaultOptions.splitColors,
        render: () => hasColorChannels,
      },
      highlightProp: {
        value: defaultOptions.highlightProp as HighlightProp,
        label: "onSelect",
        options: {
          "show weights": "weights",
          "show weighted inputs": "weightedInputs",
        },
      },
    },
    { collapsed: true },
    { store: modelConfigStore },
    [hasColorChannels, debug]
  )
  return visOptions
}
