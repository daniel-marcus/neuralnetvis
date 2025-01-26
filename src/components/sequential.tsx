import React from "react"
import { Layer } from "./layer"
import * as tf from "@tensorflow/tfjs"
import type { Dataset, LayerInput } from "@/lib/datasets"
import { useLayerProps } from "@/lib/layer-props"
import { useNeuronSelect } from "@/lib/neuron-select"
import { HoverConnections } from "./connections"

interface SequentialProps {
  model?: tf.LayersModel
  ds?: Dataset
  input?: LayerInput
  rawInput?: LayerInput
}

export const Sequential = ({ model, ds, input }: SequentialProps) => {
  const [layerProps, neuronRefs] = useLayerProps(model, ds, input)
  const patchedLayerProps = useNeuronSelect(layerProps) // TODO: prefer direct manipulation
  return (
    <group>
      {patchedLayerProps.map((props, i, layers) => {
        const { layerType, neurons } = props
        const key = `${i}_${layerType}_${neurons.length}_${patchedLayerProps.length}`
        return (
          <Layer
            key={key}
            {...props}
            allLayers={layers}
            model={model}
            neuronRefs={neuronRefs}
          />
        )
      })}
      <HoverConnections />
    </group>
  )
}
