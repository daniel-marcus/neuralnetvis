import React from "react"
import { Layer } from "./layer"
import * as tf from "@tensorflow/tfjs"
import type { Dataset, LayerInput } from "@/lib/datasets"
import { useNodeSelect } from "@/lib/node-select"
import { useActivations } from "@/lib/activations"
import { useLayerLayout } from "@/lib/layer-layout"
import { useLayerProps } from "@/lib/layer-props"

interface SequentialProps {
  model?: tf.LayersModel
  ds?: Dataset
  input?: LayerInput
  rawInput?: LayerInput
}

export const Sequential = ({ model, ds, input, rawInput }: SequentialProps) => {
  const layouts = useLayerLayout(model)
  const activations = useActivations(model, input)
  const [layerProps, neuronRefs] = useLayerProps(
    model,
    ds,
    layouts,
    activations,
    rawInput
  )
  const patchedLayerProps = useNodeSelect(layerProps)
  return (
    <group>
      {patchedLayerProps.map((props, i) => {
        const layerType = props.tfLayer.getClassName()
        const neuronCount = props.neurons.length
        const key = `${i}_${layerType}_${neuronCount}_${layerProps.length}`
        return (
          <Layer
            key={key}
            {...props}
            allLayers={layerProps}
            model={model}
            neuronRefs={neuronRefs}
          />
        )
      })}
    </group>
  )
}
