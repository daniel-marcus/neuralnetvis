import React from "react"
import { Layer } from "./layer"
import * as tf from "@tensorflow/tfjs"
import type { Dataset, LayerInput } from "@/lib/datasets"
import { useNodeSelect } from "@/lib/node-select"
import { useActivations } from "@/lib/activations"
import { useNeuronPositions } from "@/lib/neuron-positions"
import { useLayerProps } from "@/lib/layer-props"

interface SequentialProps {
  model?: tf.LayersModel
  ds?: Dataset
  input?: LayerInput
  rawInput?: LayerInput
}

export const Sequential = ({ model, ds, input, rawInput }: SequentialProps) => {
  const positions = useNeuronPositions(model)
  const activations = useActivations(model, input)
  const layerProps = useLayerProps(model, ds, positions, activations, rawInput)
  const patchedLayerProps = useNodeSelect(layerProps)
  return (
    <group>
      {patchedLayerProps.map((props, i) => (
        <Layer key={i} {...props} allLayers={layerProps} />
      ))}
    </group>
  )
}
