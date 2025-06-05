"use client"

import { SceneState } from "@/store"
import { defaultVisConfig } from "@/store/vis"
import type { Pos } from "@/scene-views/3d-model/utils"

type ExposedStoreKeys = "sampleIdx" | "layerConfigs"
type ExposedStoreType = Pick<SceneState, ExposedStoreKeys>

export type InitialState = Partial<ExposedStoreType> & {
  vis?: Partial<SceneState["vis"]>
  cameraPos?: Pos
  cameraLookAt?: Pos
}

export const defaultState: InitialState = {
  vis: defaultVisConfig,
  cameraPos: [-23, 0, 35],
  cameraLookAt: [0, 0, 0],
}
