import React, { useEffect } from "react"
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
  useEffect(() => {
    console.log("neuronRefs", neuronRefs)
  }, [neuronRefs])
  const patchedLayerProps = useNodeSelect(layerProps)
  return (
    <group>
      {patchedLayerProps.map((props, i) => (
        <Layer
          key={i}
          {...props}
          allLayers={layerProps}
          model={model}
          neuronRefs={neuronRefs}
        />
      ))}
    </group>
  )
}
