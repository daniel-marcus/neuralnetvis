"use client"

import { useEffect } from "react"
import { useStore } from "@/store"
import { moveCameraTo, type Position } from "@/scene/utils"
import type { LayerConfigArray } from "@/model"

export interface InitialState {
  datasetKey?: string
  layerConfigs?: LayerConfigArray
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
  const { datasetKey, layerConfigs, cameraPos } = initialState
  if (datasetKey) {
    useStore.getState().setDatasetKey(datasetKey)
  }
  if (layerConfigs) {
    useStore.getState().setLayerConfigs(layerConfigs)
  }
  if (cameraPos) {
    moveCameraTo(cameraPos)
  }
}
