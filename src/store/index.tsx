import { createContext, useContext, useEffect, useRef } from "react"
import { create, createStore, useStore } from "zustand"
import { createTabsSlice, TabsSlice } from "./tabs"
import { createViewSlice, View, ViewSlice } from "./view"
import { createDataSlice, DataSlice } from "./data"
import { createStatusSlice, StatusSlice } from "./status"
import { createModelSlice, ModelSlice } from "./model"
import { createTrainingSlice, TrainingSlice } from "./training"
import { createNeuronsSlice, NeuronsSlice } from "./neurons"
import { createVisSlice, VisSlice } from "./vis"
import { createVideoSlice, VideoSlice } from "./video"
import type { HandLandmarker } from "@mediapipe/tasks-vision"

export type SetterFunc<T> = (oldVal: T) => T

export type SceneState = ViewSlice &
  DataSlice &
  VideoSlice &
  ModelSlice &
  TrainingSlice &
  NeuronsSlice &
  VisSlice

const createSceneStore = (initProps?: Partial<SceneState>) => {
  return createStore<SceneState>()((...a) => ({
    ...createViewSlice(...a),
    ...createDataSlice(...a),
    ...createVideoSlice(...a),
    ...createModelSlice(...a),
    ...createTrainingSlice(...a),
    ...createNeuronsSlice(...a),
    ...createVisSlice(...a),
    ...initProps,
  }))
}

const dummySceneStore = createSceneStore()

type SceneStore = ReturnType<typeof createSceneStore>
const SceneContext = createContext<SceneStore | null>(null)

type SceneProviderProps = React.PropsWithChildren<
  {
    isActive: boolean
  } & Partial<SceneState>
>

export function SceneStoreProvider({
  children,
  isActive,
  ...props
}: SceneProviderProps) {
  const storeRef = useRef<SceneStore>(null)
  if (!storeRef.current) {
    storeRef.current = createSceneStore({ isActive, ...props })
  }
  useEffect(() => {
    if (!isActive) return
    useGlobalStore.getState().setScene(storeRef.current!)
    storeRef.current?.setState({ isActive: true })
    return () => {
      useGlobalStore.getState().setScene(dummySceneStore)
      storeRef.current?.setState({
        isActive: false,
        view: "layers",
        subset: "train",
      })
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
    scene: SceneStore
    setScene: (scene: SceneStore) => void
    handLandmarker?: HandLandmarker
    scrollPos: number // used to restore scroll position when switching from scene back to main
  }

export const useGlobalStore = create<GlobalStoreType>()((...apiProps) => ({
  ...createTabsSlice(...apiProps),
  ...createStatusSlice(...apiProps),
  backendReady: false,
  isDebug: false,
  skipModelCreate: false,
  visLocked: false,
  scene: dummySceneStore,
  setScene: (scene) => {
    const [set, get] = apiProps
    get().status.reset()
    set({ scene })
  },
  scrollPos: 0,
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
export const setView = (view: View) => getScene().setState({ view })
export const getInvisibleLayers = () =>
  getScene().getState().vis.invisibleLayers
