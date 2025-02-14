"use client"

import { useEffect } from "react"
import { StoreType, useStore } from "@/store"
import { moveCameraTo, type Position } from "@/scene/utils"

type ExposedStoreKeys =
  | "datasetKey"
  | "sampleIdx"
  | "layerConfigs"
  | "selectedNid"
type ExposedStoreType = Pick<StoreType, ExposedStoreKeys>

export type InitialState = Partial<ExposedStoreType> & {
  vis?: Partial<StoreType["vis"]>
  cameraPos?: Position
}

export const defaultState: InitialState = {
  datasetKey: "mnist",
  cameraPos: [-23, 0, 35],
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

function setInitialState(initialState: InitialState) {
  const { cameraPos, vis, ...storeSettings } = initialState
  if (cameraPos) {
    moveCameraTo(cameraPos)
  }
  if (vis) {
    useStore.getState().vis.setConfig({ ...vis })
  }
  useStore.setState(storeSettings)
}
