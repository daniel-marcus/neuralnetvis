import { create, createStore, useStore } from "zustand"
import { createTabsSlice, TabsSlice } from "./tabs"
import { createDataSlice, DataSlice } from "./data"
import { createStatusSlice, StatusSlice } from "./status"
import { createModelSlice, ModelSlice } from "./model"
import { createTrainingSlice, TrainingSlice } from "./training"
import { createNeuronsSlice, NeuronsSlice } from "./neurons"
import { createVisSlice, VisSlice } from "./vis"
import { createContext, useContext, useEffect, useRef } from "react"
import { createVideoSlice, VideoSlice } from "./video"

//

export type SceneState = DataSlice &
  VideoSlice &
  ModelSlice &
  TrainingSlice &
  NeuronsSlice &
  VisSlice

const createSceneStore = (initProps?: Partial<SceneState>) => {
  return createStore<SceneState>()((...a) => ({
    ...createDataSlice(...a),
    ...createVideoSlice(...a),
    ...createModelSlice(...a),
    ...createTrainingSlice(...a),
    ...createNeuronsSlice(...a),
    ...createVisSlice(...a),
    ...initProps,
  }))
}

type SceneStore = ReturnType<typeof createSceneStore>
const SceneContext = createContext<SceneStore | null>(null)

type SceneProviderProps = React.PropsWithChildren<
  { isActive: boolean } & Partial<SceneState>
>

const dummySceneStore = createSceneStore()

export function SceneStoreProvider({
  children,
  isActive,
  ...props
}: SceneProviderProps) {
  const storeRef = useRef<SceneStore>(null)
  if (!storeRef.current) {
    storeRef.current = createSceneStore(props)
  }
  useEffect(() => {
    if (!isActive) return
    useGlobalStore.setState({ scene: storeRef.current ?? undefined })
    return () => {
      useGlobalStore.setState({ scene: dummySceneStore })
    }
  }, [isActive])
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

export function useCurrScene<T>(selector: (state: SceneState) => T): T {
  const store = useGlobalStore((s) => s.scene)
  return useStore(store, selector)
}

//

export type GlobalStoreType = TabsSlice &
  StatusSlice & {
    backendReady: boolean
    isDebug: boolean
    skipModelCreate: boolean
    scene: SceneStore
  }

export const useGlobalStore = create<GlobalStoreType>()((...a) => ({
  ...createTabsSlice(...a),
  ...createStatusSlice(...a),
  backendReady: false,
  isDebug: false,
  skipModelCreate: false,
  visLocked: false,
  scene: dummySceneStore,
}))

//

export const isDebug = () => useGlobalStore.getState().isDebug
export const setTab = useGlobalStore.getState().setTab
export const setStatus: StatusSlice["status"]["update"] = (...args) =>
  useGlobalStore.getState().status.update(...args)
export const clearStatus: StatusSlice["status"]["clear"] = (id) =>
  useGlobalStore.getState().status.clear(id)

export const getScene = () => useGlobalStore.getState().scene

export const getDs = () => getScene().getState().ds
export const getModel = () => getScene().getState().model
export const getThree = () => getScene().getState().three
export const setLayerConfigs: ModelSlice["setLayerConfigs"] = (layerConfigs) =>
  getScene().getState().setLayerConfigs(layerConfigs)
export const setVisConfig: VisSlice["vis"]["setConfig"] = (config) =>
  getScene().getState().vis.setConfig(config)
