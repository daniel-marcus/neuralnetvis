import { create } from "zustand"
import { createTabsSlice, TabsSlice } from "./tabs"
import { createDataSlice, DataSlice } from "./data"
import { createStatusSlice, StatusSlice } from "./status"
import { createModelSlice, ModelSlice } from "./model"
import { createTrainingSlice, TrainingSlice } from "./training"
import { createLogsSlice, LogsSlice } from "./logs"
import { createSelectedSlice, SelectedSlice } from "./neuron-select"
import { createDebugSlice, DebugSlice } from "./debug"
import { createVisSlice, VisSlice } from "./vis"

type StoreType = TabsSlice &
  DataSlice &
  ModelSlice &
  TrainingSlice &
  LogsSlice &
  StatusSlice &
  SelectedSlice &
  VisSlice &
  DebugSlice

export const useStore = create<StoreType>()((...a) => ({
  ...createTabsSlice(...a),
  ...createStatusSlice(...a),
  ...createDataSlice(...a),
  ...createModelSlice(...a),
  ...createTrainingSlice(...a),
  ...createLogsSlice(...a),
  ...createSelectedSlice(...a),
  ...createVisSlice(...a),
  ...createDebugSlice(...a),
}))

export const setTab = useStore.getState().setTab
export const getDs = () => useStore.getState().ds
export const getModel = () => useStore.getState().model
export const getThree = () => useStore.getState().three
export const isDebug = () => useStore.getState().isDebug
export const setStatus: StatusSlice["status"]["setText"] = (text, percent) =>
  useStore.getState().status.setText(text, percent)
