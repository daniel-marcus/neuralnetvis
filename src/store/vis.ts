import { StateCreator } from "zustand"
import type { HighlightProp } from "@/neuron-layers/types"
import type { RootState } from "@react-three/fiber"

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
  isLocked: false,
}

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
  isLocked: boolean
}

interface VisActions {
  setConfig: (newConfig: Partial<VisConfig>) => void
  toggleLayerVisibility: (layerName: string) => void
  getDefault: (prop: keyof VisConfig) => VisConfig[keyof VisConfig]
  reset: (prop: keyof VisConfig) => void
  toggleLocked: () => void
}

interface Three {
  camera: RootState["camera"]
  invalidate: RootState["invalidate"]
  gl: RootState["gl"]
}

export type VisSlice = { vis: VisConfig & VisActions; three?: Three }

export const createVisSlice: StateCreator<VisSlice> = (set) => ({
  vis: {
    ...defaultOptions,
    setConfig: (newConfig) =>
      set(({ vis }) => ({ vis: { ...vis, ...newConfig } })),
    toggleLayerVisibility: (layerName) =>
      set(({ vis }) => ({
        vis: {
          ...vis,
          invisibleLayers: vis.invisibleLayers.includes(layerName)
            ? vis.invisibleLayers.filter((l) => l !== layerName)
            : vis.invisibleLayers.concat(layerName),
        },
      })),
    getDefault: (prop) => defaultOptions[prop],
    reset: (prop) =>
      set(({ vis }) => ({ vis: { ...vis, [prop]: defaultOptions[prop] } })),
    toggleLocked: () =>
      set(({ vis }) => ({ vis: { ...vis, isLocked: !vis.isLocked } })),
  },
  three: undefined,
})
