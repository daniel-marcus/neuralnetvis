import { useControls } from "leva"
import { Dataset, numColorChannels } from "./datasets"
import { createContext } from "react"

interface UiOptions {
  showLines: boolean
  splitColors: boolean
}

const defaultOptions = {
  showLines: true,
  splitColors: false,
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
    },
    { collapsed: true },
    [hasColorChannels]
  )
  return uiOptions
}
