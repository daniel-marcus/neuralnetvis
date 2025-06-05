import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
} from "react"
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
import { moveCameraTo } from "@/scene-views/3d-model/utils"
import { defaultState, InitialState } from "@/utils/initial-state"
import type { HandLandmarker } from "@mediapipe/tasks-vision"

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

const createSceneStore = (initProps?: InitProps) => {
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

const dummySceneStore = createSceneStore({ uid: "dummy" })

export type SceneStore = ReturnType<typeof createSceneStore>
export const SceneContext = createContext<SceneStore | null>(null)

type SceneProviderProps = React.PropsWithChildren<
  InitProps & {
    isActive: boolean
    initialState?: InitialState
    isLarge?: boolean
  }
>

export function SceneStoreProvider({
  children,
  isActive,
  initialState,
  isLarge = false,
  ...props
}: SceneProviderProps) {
  const uid = useId()
  const storeRef = useRef<SceneStore>(null)
  if (!storeRef.current) {
    const { vis: visConfig, ...otherInitialState } = initialState ?? {}
    storeRef.current = createSceneStore({
      isActive,
      uid,
      visConfig,
      ...otherInitialState,
      ...props,
    })
  }
  useEffect(() => {
    // register scene store in global store
    const thisScene = storeRef.current!
    useGlobalStore.setState((state) => ({
      scenes: [...state.scenes.filter((s) => s !== thisScene), thisScene],
    }))
    return () => {
      useGlobalStore.setState((state) => ({
        scenes: state.scenes.filter((s) => s !== thisScene),
      }))
    }
  }, [])
  useEffect(() => {
    if (!isActive) return
    const thisScene = storeRef.current!
    useGlobalStore.getState().setScene(thisScene)
    const defaultVisConfig = thisScene.getState().vis
    thisScene.setState(({ vis }) => ({
      isActive: true,
      vis: {
        ...vis,
        showHiddenLayers: !isLarge,
      },
    }))
    return () => {
      // cleanup when leaving the scene
      thisScene.setState({
        isActive: false,
        view: "layers",
        subset: "train",
        focussedLayerIdx: undefined,
        vis: { ...defaultVisConfig },
      })
      // bring camera back to initial/default position
      moveCameraTo(
        initialState?.cameraPos ?? defaultState.cameraPos,
        initialState?.cameraLookAt ?? defaultState.cameraLookAt,
        thisScene.getState().three
      )
      // reset current scene
      useGlobalStore.getState().setScene(dummySceneStore)
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

export function usePrevScene<T>(selector: (state: SceneState) => T): T {
  const scenes = useGlobalStore((s) => s.scenes)
  const currUid = useSceneStore((s) => s.uid)
  const prevSceneStore = useMemo(() => {
    const allScenes = scenes.map((s) => s.getState())
    const currIdx = allScenes.findIndex((s) => s.uid === currUid)
    return scenes[currIdx - 1] ?? dummySceneStore
  }, [scenes, currUid])
  return useStore(prevSceneStore, selector)
}

// Global Store

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
}))

// shortcut getters and setters to use from everywhere

export const isDebug = () => useGlobalStore.getState().isDebug
export const setTab = useGlobalStore.getState().setTab
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
export const setView = (view: View) => getScene().setState({ view })
export const getExcludedLayers = () => getScene().getState().vis.excludedLayers

export const getLayers = () => getScene().getState().allLayers
export function useHasFocussed() {
  return useSceneStore((s) => typeof s.focussedLayerIdx === "number")
}
