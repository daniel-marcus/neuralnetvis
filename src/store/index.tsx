import { create, createStore, useStore } from "zustand"
import { createTabsSlice, TabsSlice } from "./tabs"
import { createDataSlice, DataSlice } from "./data"
import { createStatusSlice, StatusSlice } from "./status"
import { createModelSlice, ModelSlice } from "./model"
import { createTrainingSlice, TrainingSlice } from "./training"
import { createNeuronsSlice, NeuronsSlice } from "./neurons"
import { createVisSlice, VisSlice } from "./vis"
import { Nid } from "@/neuron-layers"
import { createContext, useContext, useRef } from "react"

type TodoStoreType = DataSlice &
  ModelSlice &
  TrainingSlice &
  NeuronsSlice &
  VisSlice

export type GlobalStoreType = TabsSlice &
  StatusSlice & { isDebug: boolean } & TodoStoreType

export const useGlobalStore = create<GlobalStoreType>()((...a) => ({
  ...createTabsSlice(...a),
  ...createStatusSlice(...a),
  isDebug: false,

  ...createDataSlice(...a),
  ...createModelSlice(...a),
  ...createTrainingSlice(...a),
  ...createNeuronsSlice(...a),
  ...createVisSlice(...a),
}))

//

type SceneState = DataSlice &
  ModelSlice &
  TrainingSlice &
  NeuronsSlice &
  VisSlice

const createSceneStore = (initProps?: Partial<SceneState>) => {
  return createStore<SceneState>()((...a) => ({
    ...createDataSlice(...a),
    ...createModelSlice(...a),
    ...createTrainingSlice(...a),
    ...createNeuronsSlice(...a),
    ...createVisSlice(...a),
    ...initProps,
  }))
}

type SceneStore = ReturnType<typeof createSceneStore>
const SceneContext = createContext<SceneStore | null>(null)

type SceneProviderProps = React.PropsWithChildren<Partial<SceneState>>

export function SceneStoreProvider({ children, ...props }: SceneProviderProps) {
  const storeRef = useRef<SceneStore>(null)
  if (!storeRef.current) {
    storeRef.current = createSceneStore(props)
  }
  return (
    <SceneContext.Provider value={storeRef.current}>
      {children}
    </SceneContext.Provider>
  )
}

export function useSceneStore<T>(selector: (state: SceneState) => T): T {
  const store = useContext(SceneContext)
  if (!store) throw new Error("Missing SceneStoreProvider in the tree")
  return useStore(store, selector)
}

//

export const isDebug = () => useGlobalStore.getState().isDebug
export const setTab = useGlobalStore.getState().setTab
export const setStatus: StatusSlice["status"]["update"] = (...args) =>
  useGlobalStore.getState().status.update(...args)
export const clearStatus: StatusSlice["status"]["clear"] = (id) =>
  useGlobalStore.getState().status.clear(id)

export const getDs = () => useGlobalStore.getState().ds
export const getModel = () => useGlobalStore.getState().model
export const getNeuron = (nid: Nid) =>
  useGlobalStore.getState().allNeurons.get(nid)
export const getThree = () => useGlobalStore.getState().three
export const setLayerConfigs: ModelSlice["setLayerConfigs"] = (layerConfigs) =>
  useGlobalStore.getState().setLayerConfigs(layerConfigs)
export const setVisConfig: VisSlice["vis"]["setConfig"] = (config) =>
  useGlobalStore.getState().vis.setConfig(config)
