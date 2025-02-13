import React from "react"
import { useModelStore } from "@/model/model"
import { useLayerProps } from "@/neuron-layers/layer-props"
import { useNeuronSelect } from "@/neuron-layers/neuron-select"
import { Layer } from "./layer"
import { HoverConnections } from "./connections"

export const Model = () => {
  const model = useModelStore((s) => s.model)
  const [layerProps, neuronRefs] = useLayerProps(model)
  const patchedLayerProps = useNeuronSelect(layerProps)
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
