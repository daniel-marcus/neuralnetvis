import { StateCreator } from "zustand"
import type { HighlightProp } from "@/neuron-layers/types"
import { RootState } from "@react-three/fiber"
import { OrbitControls } from "three-stdlib"

export const defaultVisConfig = {
  flatView: false,
  xShift: 11,
  yShift: 0,
  zShift: 0,
  neuronSpacing: 1.1,
  showPointer: true,
  showLines: true,
  splitColors: false,
  highlightProp: "weightedInputs" as const,
  lineActivationThreshold: 0.5,
  invisibleLayers: [],
  isLocked: false,
  lightsOn: true,
  lightIntensity: 1,
}

export interface VisConfig {
  flatView: boolean
  xShift: number
  yShift: number
  zShift: number
  neuronSpacing: number
  showPointer: boolean
  splitColors: boolean
  highlightProp: HighlightProp // | string
  showLines: boolean
  lineActivationThreshold: number
  invisibleLayers: string[]
  isLocked: boolean
  lightsOn: boolean
  lightIntensity: number
}

interface VisActions {
  setConfig: (newConfig: Partial<VisConfig>) => void
  toggleLayerVisibility: (layerName: string) => void
  getDefault: (prop: keyof VisConfig) => VisConfig[keyof VisConfig]
  reset: (prop: keyof VisConfig) => void
  toggleLocked: () => void
  toggleLights: () => void
}

export interface Three {
  camera: RootState["camera"]
  controls: OrbitControls | null
  invalidate: RootState["invalidate"]
  gl: RootState["gl"]
}

export type VisSlice = {
  vis: VisConfig & VisActions
  three?: Three
  setThree: (three: Three) => void
}

export const createVisSlice: StateCreator<VisSlice> = (set) => ({
  vis: {
    ...defaultVisConfig,
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
    getDefault: (prop) => defaultVisConfig[prop],
    reset: (prop) =>
      set(({ vis }) => ({ vis: { ...vis, [prop]: defaultVisConfig[prop] } })),
    toggleLocked: () =>
      set(({ vis }) => ({ vis: { ...vis, isLocked: !vis.isLocked } })),
    toggleLights: () =>
      set(({ vis }) => ({ vis: { ...vis, lightsOn: !vis.lightsOn } })),
  },
  three: undefined,
  setThree: (three) => set({ three }),
})
