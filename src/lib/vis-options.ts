import { useControls } from "leva"
import { Dataset, numColorChannels } from "./datasets"
import { createContext } from "react"
import { useLevaStores } from "@/components/menu"

export type HighlightProp = "weights" | "weightedInputs"

interface VisOptions {
  layerSpacing: number
  showLines: boolean
  splitColors: boolean
  highlightProp: HighlightProp | string
}

const defaultOptions = {
  layerSpacing: 10,
  showLines: true,
  splitColors: false,
  highlightProp: "weightedInputs",
}

export const VisOptionsContext = createContext<VisOptions>(defaultOptions)

export function useVisOptions(ds?: Dataset) {
  const hasColorChannels = numColorChannels(ds) > 1
  const { visStore } = useLevaStores()
  const visOptions: VisOptions = useControls(
    {
      layerSpacing: {
        label: "spacing",
        value: defaultOptions.layerSpacing,
        min: 1,
        max: 16,
        step: 1,
      },
      showLines: defaultOptions.showLines,
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
    { store: visStore },
    [hasColorChannels]
  )
  return visOptions
}
