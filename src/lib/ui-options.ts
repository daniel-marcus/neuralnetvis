import { useControls } from "leva"
import { Dataset, numColorChannels } from "./datasets"
import { createContext } from "react"

export type HighlightProp = "weights" | "weightedInputs"

interface UiOptions {
  showLines: boolean
  splitColors: boolean
  highlightProp: HighlightProp | string
}

const defaultOptions = {
  showLines: true,
  splitColors: false,
  highlightProp: "weightedInputs",
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
        label: "onSelect",
        options: {
          "show weights": "weights",
          "show weighted inputs": "weightedInputs",
        },
      },
    },
    { collapsed: true },
    [hasColorChannels]
  )
  return uiOptions
}
