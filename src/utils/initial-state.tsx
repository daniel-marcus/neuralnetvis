"use client"

import { useEffect } from "react"
import { StoreType, useStore } from "@/store"
import { moveCameraTo, type Pos } from "@/scene/utils"
import { defaultLayerConfigs } from "@/store/model"
import { defaultVisConfig } from "@/store/vis"

type ExposedStoreKeys =
  | "datasetKey"
  | "sampleIdx"
  | "layerConfigs"
  | "selectedNid"
type ExposedStoreType = Pick<StoreType, ExposedStoreKeys>

export type InitialState = Partial<ExposedStoreType> & {
  vis?: Partial<StoreType["vis"]>
  cameraPos?: Pos
}

export const defaultState: InitialState = {
  datasetKey: "mnist",
  layerConfigs: defaultLayerConfigs,
  cameraPos: [-23, 0, 35],
  vis: defaultVisConfig,
}

export function useInitialState(state = defaultState) {
  const three = useStore((s) => s.three)
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
  const { cameraPos, vis, ...storeSettings } = initialState
  if (cameraPos) {
    moveCameraTo(cameraPos)
  }
  if (vis) {
    useStore.getState().vis.setConfig({ ...vis })
  }
  useStore.setState(storeSettings)
}
