"use client"

import { useDatasetStore } from "@/data/datasets"
import { HiddenLayerConfigArray, useModelStore } from "@/tf/model"
import { useEffect } from "react"

export interface InitialState {
  datasetKey?: string
  hiddenLayers?: HiddenLayerConfigArray
}

export function setInitialState(initialState: InitialState) {
  const { datasetKey, hiddenLayers } = initialState
  if (datasetKey) {
    useDatasetStore.getState().setDatasetKey(datasetKey)
  }
  if (hiddenLayers) {
    useModelStore.getState().setHiddenLayers(hiddenLayers)
  }
}

export function DefaultInitialStateSetter() {
  useEffect(() => {
    setInitialState({ datasetKey: "mnist" })
  }, [])
  return null
}
