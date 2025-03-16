"use client"

import { useEffect } from "react"
import { SceneState, useSceneStore } from "@/store"
import { moveCameraTo, type Pos } from "@/scene/utils"
import { defaultLayerConfigs } from "@/store/model"
import { defaultVisConfig } from "@/store/vis"

type ExposedStoreKeys = "sampleIdx" | "layerConfigs"
type ExposedStoreType = Pick<SceneState, ExposedStoreKeys>

export type InitialState = Partial<ExposedStoreType> & {
  vis?: Partial<SceneState["vis"]>
  cameraPos?: Pos
  cameraLookAt?: Pos
}

export const defaultState: InitialState = {
  layerConfigs: defaultLayerConfigs,
  vis: defaultVisConfig,
  cameraPos: [-23, 0, 35],
  cameraLookAt: [0, 0, 0],
}

export function useInitialState(state?: InitialState) {
  const three = useSceneStore((s) => s.three)
  const setLayersConfig = useSceneStore((s) => s.setLayerConfigs)
  const setVisConfig = useSceneStore((s) => s.vis.setConfig)
  const setSampleIdx = useSceneStore((s) => s.setSampleIdx)
  useEffect(() => {
    if (!three || !state) return
    const { cameraPos, cameraLookAt } = state
    if (cameraPos) {
      moveCameraTo(cameraPos, cameraLookAt, three)
    }
    if (state.vis) setVisConfig({ ...state.vis })
    if (state.layerConfigs) setLayersConfig(state.layerConfigs)
    if (state.sampleIdx) setSampleIdx(state.sampleIdx)
  }, [state, three, setLayersConfig, setVisConfig, setSampleIdx])
}
