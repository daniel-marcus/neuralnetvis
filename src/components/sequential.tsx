import React from "react"
import { Layer } from "./layer"
import * as tf from "@tensorflow/tfjs"
import type { Dataset, LayerInput } from "@/lib/datasets"
import { useActivations } from "@/lib/activations"
import { useLayerLayout } from "@/lib/layer-layout"
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
  const layouts = useLayerLayout(model)
  const activations = useActivations(model, input)
  const [layerProps, neuronRefs] = useLayerProps(
    model,
    ds,
    layouts,
    activations
  )
  const patchedLayerProps = useNeuronSelect(layerProps)
  return (
    <group>
      {patchedLayerProps.map((props, i) => {
        const layerType = props.tfLayer.getClassName()
        const { neurons, ...otherProps } = props
        const neuronCount = props.neurons.length
        const key = `${i}_${layerType}_${neuronCount}_${patchedLayerProps.length}`
        return (
          <Layer
            key={key}
            neurons={neurons}
            {...otherProps}
            allLayers={patchedLayerProps}
            model={model}
            neuronRefs={neuronRefs}
          />
        )
      })}
      <HoverConnections />
    </group>
  )
}
