import React from "react"
import { Layer } from "./layer"
import * as tf from "@tensorflow/tfjs"
import { useLayerProps } from "@/lib/layer-props"
import { useNeuronSelect } from "@/lib/neuron-select"
import { HoverConnections } from "./connections"
import { useDebug } from "@/lib/debug"

interface ModelProps {
  model?: tf.LayersModel
  batchCount?: number
  isPending: boolean
}

export const Model = ({ model, batchCount, isPending }: ModelProps) => {
  useDebug()
  const [layerProps, neuronRefs] = useLayerProps(isPending, model, batchCount)
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
