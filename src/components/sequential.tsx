import React, { ReactElement, createContext, useMemo } from "react"
import { Dense, DenseProps } from "./dense"
import * as tf from "@tensorflow/tfjs"
import { normalize } from "./model"

export type Layer = ReactElement<DenseProps>
export type LayerType = "input" | "output" | "hidden"

interface SequentialProps {
  model: tf.LayersModel
  input?: number[]
}

export const ModelContext = createContext<tf.LayersModel>(null!)
export const LayerContext = createContext([] as Layer[])

export const Sequential = ({ model, input }: SequentialProps) => {
  const activations = useActivations(model, input)
  const layers = model.layers.map((l, i) => {
    const units = (l.getConfig().units as number) ?? l.batchInputShape?.[1] ?? 0
    const type = getLayerType(model.layers.length, i)
    const layerActivations = type === "input" ? input : activations?.[i]?.[0]
    const normalizedActivations =
      type === "output" ? layerActivations : normalize(layerActivations)
    return (
      <Dense
        key={i}
        index={i}
        type={type}
        units={units}
        positions={getNeuronPositions(i, model.layers.length, units)}
        activations={layerActivations}
        normalizedActivations={normalizedActivations}
        weights={getWeights(l)}
        biases={getBiases(l)}
      />
    )
  })
  return (
    <ModelContext.Provider value={model}>
      <LayerContext.Provider value={layers}>{layers}</LayerContext.Provider>
    </ModelContext.Provider>
  )
}

function getWeights(layer: tf.layers.Layer) {
  return layer.getWeights()[0]?.arraySync() as number[][]
}

function getBiases(layer: tf.layers.Layer) {
  return layer.getWeights()[1]?.arraySync() as number[]
}

function useActivations(model: tf.LayersModel, input?: number[]) {
  return useMemo(() => {
    if (!model || !input) return []
    const tensor = tf.tensor([input])

    /* const prediction = model.predict(tensor) as tf.Tensor
    const result = prediction.arraySync() as number[][]
    const predictedClass = result[0].indexOf(Math.max(...result[0]))
    console.log("Predicted class:", predictedClass) */

    // Define a model that outputs activations for each layer
    const layerOutputs = model.layers.flatMap((layer) => layer.output)
    // Create a new model that will return the activations
    const activationModel = tf.model({
      inputs: model.input,
      outputs: layerOutputs,
    })

    // Get the activations for each layer
    const _activations = activationModel.predict(tensor) as tf.Tensor<tf.Rank>[]

    const activations = _activations.map(
      (activation) => activation.arraySync() as number[][]
    )
    return activations
  }, [model, input])
}

const LAYER_SPACING = 12

export function getNeuronPositions(
  layerIndex: number,
  totalLayers: number,
  units: number
) {
  const type = getLayerType(totalLayers, layerIndex)
  const offsetX =
    layerIndex * LAYER_SPACING + (totalLayers - 1) * LAYER_SPACING * -0.5
  const positions = Array.from({ length: units }).map((_, i) => {
    const x = offsetX
    const [y, z] =
      type === "output" ? getLineYZ(i, units) : getGridYZ(i, units, type)
    return [x, y, z] as [number, number, number]
  })
  return positions
}

export function getLayerType(totalLayers: number, index: number): LayerType {
  if (index === 0) return "input"
  if (index === totalLayers - 1) return "output"
  return "hidden"
}

function getGridYZ(
  i: number,
  total: number,
  type: LayerType
): [number, number] {
  const NEURON_SPACING = type === "input" ? 0.7 : 1.8
  const gridSize = Math.ceil(Math.sqrt(total))
  const offsetY = (gridSize - 1) * NEURON_SPACING * 0.5
  const offsetZ = (gridSize - 1) * NEURON_SPACING * -0.5
  const y = -1 * Math.floor(i / gridSize) * NEURON_SPACING + offsetY // row
  const z = (i % gridSize) * NEURON_SPACING + offsetZ // column
  return [y, z] as const
}

function getLineYZ(i: number, total: number): [number, number] {
  const NEURON_SPACING = 3
  const offsetZ = (total - 1) * NEURON_SPACING * -0.5
  const y = 0
  const z = i * NEURON_SPACING + offsetZ
  return [y, z] as const
}
