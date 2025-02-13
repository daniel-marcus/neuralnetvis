"use client"

import { useDatasetStore } from "@/data/data"
import { LayerConfigArray, useModelStore } from "@/model/model"
import { useEffect } from "react"

export interface InitialState {
  datasetKey?: string
  layerConfigs?: LayerConfigArray
}

export function setInitialState(initialState: InitialState) {
  const { datasetKey, layerConfigs } = initialState
  if (datasetKey) {
    useDatasetStore.getState().setDatasetKey(datasetKey)
  }
  if (layerConfigs) {
    useModelStore.getState().setLayerConfigs(layerConfigs)
  }
}

export function DefaultInitialStateSetter() {
  useEffect(() => {
    setInitialState({ datasetKey: "mnist" })
  }, [])
  return null
}
