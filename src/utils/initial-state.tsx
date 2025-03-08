"use client"

import { useEffect } from "react"
import { StoreType, useGlobalStore } from "@/store"
import { moveCameraTo, type Pos } from "@/scene/utils"
import { defaultLayerConfigs } from "@/store/model"
import { defaultVisConfig } from "@/store/vis"
import { setDsFromKey } from "@/data/dataset"

type ExposedStoreKeys =
  | "sampleIdx"
  | "layerConfigs"
  | "selectedNid"
  | "activeTile"
type ExposedStoreType = Pick<StoreType, ExposedStoreKeys>

export type InitialState = Partial<ExposedStoreType> & {
  dsKey?: string
  vis?: Partial<StoreType["vis"]>
  cameraPos?: Pos
  cameraLookAt?: Pos
}

export const defaultState: InitialState = {
  activeTile: null,
  // dsKey: "mnist",
  layerConfigs: defaultLayerConfigs,
  selectedNid: undefined,
  cameraPos: [-23, 0, 35],
  cameraLookAt: [0, 0, 0],
  vis: defaultVisConfig,
}

export function useInitialState(state = defaultState) {
  const three = useGlobalStore((s) => s.three)
  useEffect(() => {
    if (!three) return
    setInitialState(state)
  }, [state, three])
}

export function InitialStateSetter() {
  useInitialState()
  return null
}

export function setInitialState(initialState: InitialState = defaultState) {
  const { dsKey, cameraPos, cameraLookAt, vis, ...storeSettings } = initialState
  if (dsKey) setDsFromKey(dsKey)
  if (cameraPos) {
    moveCameraTo(cameraPos, cameraLookAt)
  }
  if (vis) {
    useGlobalStore.getState().vis.setConfig({ ...vis })
  }
  useGlobalStore.setState(storeSettings)
}
