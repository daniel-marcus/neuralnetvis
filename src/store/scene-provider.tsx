import { useEffect, useId, useState } from "react"
import { moveCameraTo } from "@/scene-views/3d-model/utils"
import { defaultState, InitialState } from "@/utils/initial-state"
import {
  SceneContext,
  SceneState,
  useGlobalStore,
  createSceneStore,
  dummySceneStore,
} from "@/store"

type InitProps = Partial<SceneState> & {
  visConfig?: Partial<SceneState["vis"]>
}

type SceneProviderProps = React.PropsWithChildren<
  InitProps & {
    isActive: boolean
    initialState?: InitialState
  }
>

export function SceneStoreProvider({
  children,
  isActive,
  initialState,
  isLargeModel = false,
  ...props
}: SceneProviderProps) {
  const uid = useId()
  const [thisScene] = useState(() => {
    const { vis: visConfig, ...otherInitialState } = initialState ?? {}
    return createSceneStore({
      isActive,
      uid,
      visConfig,
      isLargeModel,
      ...otherInitialState,
      ...props,
    })
  })
  useEffect(() => {
    useGlobalStore.setState((state) => ({
      scenes: [...state.scenes.filter((s) => s !== thisScene), thisScene],
    }))
    return () => {
      useGlobalStore.setState((state) => ({
        scenes: state.scenes.filter((s) => s !== thisScene),
      }))
    }
  }, [thisScene])
  useEffect(() => {
    if (!isActive) return
    useGlobalStore.getState().setScene(thisScene)
    const defaultVisConfig = thisScene.getState().vis
    thisScene.setState({ isActive: true })
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
        thisScene.getState().three,
      )
      // reset current scene
      useGlobalStore.getState().setScene(dummySceneStore)
    }
  }, [thisScene, isActive, initialState])
  return <SceneContext.Provider value={thisScene}>{children}</SceneContext.Provider>
}
