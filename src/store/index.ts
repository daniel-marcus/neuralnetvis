import { create } from "zustand"
import { createTabsSlice, TabsSlice } from "./tabs"
import { createDataSlice, DataSlice } from "./data"
import { createStatusSlice, StatusSlice } from "./status"
import { createModelSlice, ModelSlice } from "./model"
import { createTrainingSlice, TrainingSlice } from "./training"
import { createNeuronsSlice, NeuronsSlice } from "./neurons"
import { createVisSlice, VisSlice } from "./vis"
import { Nid } from "@/neuron-layers"

export type StoreType = TabsSlice &
  StatusSlice &
  DataSlice &
  ModelSlice &
  TrainingSlice &
  NeuronsSlice &
  VisSlice & { isDebug: boolean }

export const useStore = create<StoreType>()((...a) => ({
  ...createTabsSlice(...a),
  ...createStatusSlice(...a),
  ...createDataSlice(...a),
  ...createModelSlice(...a),
  ...createTrainingSlice(...a),
  ...createNeuronsSlice(...a),
  ...createVisSlice(...a),
  isDebug: false,
}))

export const setTab = useStore.getState().setTab
export const getDs = () => useStore.getState().ds
export const getModel = () => useStore.getState().model
export const getNeuron = (nid: Nid) => useStore.getState().allNeurons.get(nid)
export const getThree = () => useStore.getState().three
export const isDebug = () => useStore.getState().isDebug
export const setStatus: StatusSlice["status"]["update"] = (text, percent, id) =>
  useStore.getState().status.update(text, percent, id)
export const clearStatus: StatusSlice["status"]["clear"] = (id) =>
  useStore.getState().status.clear(id)
export const setLayerConfigs: ModelSlice["setLayerConfigs"] = (layerConfigs) =>
  useStore.getState().setLayerConfigs(layerConfigs)
export const setVisConfig: VisSlice["vis"]["setConfig"] = (config) =>
  useStore.getState().vis.setConfig(config)
