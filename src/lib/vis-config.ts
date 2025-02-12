import { create } from "zustand"

export type HighlightProp = "weights" | "weightedInputs"

interface VisConfig {
  xShift: number
  yShift: number
  zShift: number
  neuronSpacing: number
  splitColors: boolean
  highlightProp: HighlightProp | string
  showLines: boolean
  lineActivationThreshold: number
  allowDenseHoverLines: boolean
  invisibleLayers: string[]
}

const defaultOptions = {
  xShift: 10,
  yShift: 0,
  zShift: 0,
  neuronSpacing: 1.1,
  showLines: true,
  splitColors: false,
  highlightProp: "weightedInputs",
  lineActivationThreshold: 0.5,
  allowDenseHoverLines: false,
  invisibleLayers: [],
}

interface VisConfigStore extends VisConfig {
  setVisConfig: (newConfig: Partial<VisConfig>) => void
  toggleLayerVisibility: (layerName: string) => void
}

export const useVisConfigStore = create<VisConfigStore>((set) => ({
  ...defaultOptions,
  setVisConfig: (newConfig) => set((state) => ({ ...state, ...newConfig })),
  toggleLayerVisibility: (layerName) =>
    set(({ invisibleLayers }) => ({
      invisibleLayers: invisibleLayers.includes(layerName)
        ? invisibleLayers.filter((l) => l !== layerName)
        : invisibleLayers.concat(layerName),
    })),
}))
