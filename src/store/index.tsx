import React, { useContext } from "react"

import { create, createStore, useStore } from "zustand"
import { createTabsSlice, TabsSlice } from "./tabs"
import { createViewSlice, ViewSlice } from "./view"
import { createDataSlice, DataSlice } from "./data"
import { createStatusSlice, StatusSlice } from "./status"
import { createModelSlice, ModelSlice } from "./model"
import { createTrainingSlice, TrainingSlice } from "./training"
import { createNeuronsSlice, NeuronsSlice } from "./neurons"
import { createVisSlice, VisSlice } from "./vis"
import { createVideoSlice, VideoSlice } from "./video"
import type { HandLandmarker } from "@mediapipe/tasks-vision"
import type { WebGPURenderer } from "three/webgpu"

export type SetterFunc<T> = (oldVal: T) => T

export type SceneState = ViewSlice &
  DataSlice &
  VideoSlice &
  ModelSlice &
  TrainingSlice &
  NeuronsSlice &
  VisSlice

type InitProps = Partial<SceneState> & {
  visConfig?: Partial<SceneState["vis"]>
}

export const createSceneStore = (initProps?: InitProps) => {
  const { visConfig = {}, ...otherInitProps } = initProps ?? {}
  return createStore<SceneState>()((...a) => {
    const visSlice = createVisSlice(...a)
    return {
      ...createViewSlice(...a),
      ...createDataSlice(...a),
      ...createVideoSlice(...a),
      ...createModelSlice(...a),
      ...createTrainingSlice(...a),
      ...createNeuronsSlice(...a),
      ...visSlice,
      vis: { ...visSlice.vis, ...visConfig }, // merge with initial vis config
      ...otherInitProps,
    }
  })
}

export const dummySceneStore = createSceneStore({ uid: "dummy" })

export type SceneStore = ReturnType<typeof createSceneStore>
export const SceneContext = React.createContext<SceneStore | null>(null)

export function useSceneStore<T>(selector: (state: SceneState) => T): T {
  const store = useContext(SceneContext)
  if (!store) throw new Error("Missing SceneStoreProvider in the tree")
  return useStore(store, selector)
}

export function useCurrScene<T>(selector: (state: SceneState) => T): T {
  const store = useGlobalStore((s) => s.scene)
  return useStore(store, selector)
}

// Global Store

type WindowSize = { width: number; height: number }

export type GlobalStoreType = TabsSlice &
  StatusSlice & {
    backendReady: boolean
    isDebug: boolean
    scenes: SceneStore[]
    scene: SceneStore
    setScene: (scene: SceneStore) => void
    handLandmarker?: HandLandmarker
    scrollPos: number // used to restore scroll position when switching from scene back to main
    gpuDevice: GPUDevice | null | undefined
    renderer: WebGPURenderer | null
    windowSize: WindowSize
    setWindowSize: (size: WindowSize) => void
  }

export const useGlobalStore = create<GlobalStoreType>()((...apiProps) => ({
  ...createTabsSlice(...apiProps),
  ...createStatusSlice(...apiProps),
  backendReady: false,
  isDebug: false,
  visLocked: false,
  scenes: [],
  scene: dummySceneStore,
  setScene: (scene) => {
    const [set, get] = apiProps
    get().status.reset()
    set({ scene })
  },
  scrollPos: 0,
  gpuDevice: null,
  renderer: null,
  windowSize: { width: 0, height: 0 },
  setWindowSize: (windowSize) => {
    const [set] = apiProps
    set({ windowSize })
  },
}))

// shortcut getters and setters to use from everywhere

export const isDebug = () => useGlobalStore.getState().isDebug
export const setStatus: StatusSlice["status"]["update"] = (...args) =>
  useGlobalStore.getState().status.update(...args)
export const clearStatus: StatusSlice["status"]["clear"] = (id) =>
  useGlobalStore.getState().status.clear(id)

export const getScene = () => useGlobalStore.getState().scene // current scene only

export const getDs = () => getScene().getState().ds
export const getModel = () => getScene().getState().model
export const getThree = () => getScene().getState().three
export const setLayerConfigs: ModelSlice["setLayerConfigs"] = (layerConfigs) =>
  getScene().getState().setLayerConfigs(layerConfigs)
export const setVisConfig: VisSlice["vis"]["setConfig"] = (config) =>
  getScene().getState().vis.setConfig(config)
export const getVisConfig: VisSlice["vis"]["getConfig"] = (key) =>
  getScene().getState().vis.getConfig(key)

export const getLayers = () => getScene().getState().allLayers
export function useHasFocussed() {
  return useSceneStore((s) => typeof s.focussedLayerIdx === "number")
}
