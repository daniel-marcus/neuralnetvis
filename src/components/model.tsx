import React from "react"
import { Layer } from "./layer"
import * as tf from "@tensorflow/tfjs"
import type { Dataset, LayerInput } from "@/lib/datasets"
import { useLayerProps } from "@/lib/layer-props"
import { useNeuronSelect } from "@/lib/neuron-select"
import { HoverConnections } from "./connections"
import { useDebug } from "@/lib/debug"

interface ModelProps {
  isPending: boolean
  model?: tf.LayersModel
  ds?: Dataset
  input?: LayerInput
  rawInput?: LayerInput
  batchCount?: number
}

export const Model = ({
  model,
  ds,
  input,
  isPending,
  batchCount,
}: ModelProps) => {
  useDebug()
  const [layerProps, neuronRefs] = useLayerProps(
    isPending,
    model,
    ds,
    input,
    batchCount
  )
  const patchedLayerProps = useNeuronSelect(layerProps) // TODO: prefer direct manipulation
  return (
    <group>
      {patchedLayerProps.map((props, i, layers) => {
        const { layerType, neurons } = props
        const key = `${i}_${layerType}_${neurons.length}_${layers.length}`
        return (
          <Layer
            key={key}
            {...props}
            allLayers={layers}
            neuronRefs={neuronRefs}
          />
        )
      })}
      <HoverConnections />
    </group>
  )
}
