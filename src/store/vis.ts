import type { StateCreator } from "zustand"
import type { HighlightProp } from "@/neuron-layers/types"
import type { RootState } from "@react-three/fiber"
import type { OrbitControls } from "three-stdlib"

export const defaultVisConfig = {
  showHiddenLayers: false,
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
  excludedLayers: [],
  isLocked: false,
  lightsOn: true,
  lightIntensity: 1,
  autoRotate: false,
}

export interface VisConfig {
  showHiddenLayers: boolean // switch on/off hidden layers (positions change)
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
  excludedLayers: string[] // currently used only in lesson: temporary switch off layers (positions remain)
  isLocked: boolean
  lightsOn: boolean
  lightIntensity: number
  autoRotate: boolean
}

interface VisActions {
  setConfig: (newConfig: Partial<VisConfig>) => void
  getConfig: <T extends keyof VisConfig>(key: T) => VisConfig[T]
  toggleShowHiddenLayers: () => void
  toggleLayerVisibility: (layerName: string) => void
  getDefault: <T extends keyof VisConfig>(key: T) => VisConfig[T]
  reset: <T extends keyof VisConfig>(key: T) => void
  toggleLocked: () => void
  toggleLights: () => void
  toggleAutoRotate: () => void
  setFlatView: (flatView: boolean) => void
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
  hasRendered: boolean
  setHasRendered: () => void
}

export const createVisSlice: StateCreator<VisSlice> = (set, get) => ({
  vis: {
    ...defaultVisConfig,
    setConfig: (newConfig) =>
      set(({ vis }) => ({ vis: { ...vis, ...newConfig } })),
    getConfig: (key) => get().vis[key],
    toggleShowHiddenLayers: () =>
      set(({ vis }) => ({
        vis: { ...vis, showHiddenLayers: !vis.showHiddenLayers },
      })),
    toggleLayerVisibility: (layerName) =>
      set(({ vis }) => ({
        vis: {
          ...vis,
          excludedLayers: vis.excludedLayers.includes(layerName)
            ? vis.excludedLayers.filter((l) => l !== layerName)
            : vis.excludedLayers.concat(layerName),
        },
      })),
    getDefault: (key) => defaultVisConfig[key],
    reset: (key) =>
      set(({ vis }) => ({ vis: { ...vis, [key]: defaultVisConfig[key] } })),
    toggleLocked: () =>
      set(({ vis }) => ({ vis: { ...vis, isLocked: !vis.isLocked } })),
    toggleLights: () =>
      set(({ vis }) => ({ vis: { ...vis, lightsOn: !vis.lightsOn } })),
    toggleAutoRotate: () =>
      set(({ vis }) => ({ vis: { ...vis, autoRotate: !vis.autoRotate } })),
    setFlatView: (flatView) =>
      set(({ vis }) => ({ vis: { ...vis, flatView } })),
  },
  three: undefined,
  setThree: (three) => set({ three }),
  hasRendered: false,
  setHasRendered: () => set({ hasRendered: true }),
})
