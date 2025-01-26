import { useControls } from "leva"
import { Dataset, numColorChannels } from "./datasets"
import { createContext, useEffect } from "react"
import { DEBUG, toggleDebug } from "./_debug"
import { useStatusText } from "@/components/status-text"

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
      highlightProp: {
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

  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === "d") {
        toggleDebug()
        setStatusText(`Debug mode ${DEBUG ? "enabled" : "disabled"}`)
      }
    }
    window.addEventListener("keydown", onKeydown)
    return () => {
      window.removeEventListener("keydown", onKeydown)
    }
  }, [setStatusText])

  return uiOptions
}
