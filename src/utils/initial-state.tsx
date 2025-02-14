"use client"

import { useDatasetStore } from "@/data/dataset"
import { LayerConfigArray, useModelStore } from "@/model/model"
import { useThreeStore } from "@/scene/three-store"
import { moveCameraTo, Position } from "@/scene/utils"
import { useEffect } from "react"

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
  const three = useThreeStore((s) => s.three)
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
    useDatasetStore.getState().setDatasetKey(datasetKey)
  }
  if (layerConfigs) {
    useModelStore.getState().setLayerConfigs(layerConfigs)
  }
  if (cameraPos) {
    moveCameraTo(cameraPos)
  }
}
