import React, { useMemo } from "react"
import { Dense, DenseProps } from "./dense"
import * as tf from "@tensorflow/tfjs"
import { normalize } from "@/lib/datasets"

export type LayerProps = DenseProps
export type LayerType = "input" | "output" | "hidden"

interface SequentialProps {
  model: tf.LayersModel
  input?: number[]
  labelNames?: string[]
}

export const Sequential = ({ model, input, labelNames }: SequentialProps) => {
  const activations = useActivations(model, input)
  const layerProps = useMemo(
    () =>
      model.layers.map((l, i) => {
        const units =
          (l.getConfig().units as number) ?? l.batchInputShape?.[1] ?? 0
        const type = getLayerType(model.layers.length, i)
        const layerActivations =
          type === "input" ? input : activations?.[i]?.[0]
        const normalizedActivations =
          type === "output" ? layerActivations : normalize(layerActivations)
        return {
          index: i,
          type,
          units,
          activations: layerActivations,
          normalizedActivations,
          weights: getWeights(l),
          biases: getBiases(l),
          positions: getNeuronPositions(i, model.layers.length, units),
          labelNames: type === "output" ? labelNames : undefined,
        }
      }),
    [input, activations, model, labelNames]
  )
  return (
    <group>
      {layerProps.map((props, i) => (
        <Dense key={i} {...props} prevLayer={layerProps[i - 1]} />
      ))}
    </group>
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

    // Define a model that outputs activations for each layer
    const layerOutputs = model.layers.flatMap((layer) => layer.output)
    // Create a new model that will return the activations
    const activationModel = tf.model({
      inputs: model.input,
      outputs: layerOutputs,
    })

    const tensor = tf.tensor([input])
    // Get the activations for each layer
    const _activations = activationModel.predict(tensor) as tf.Tensor<tf.Rank>[]

    const activations = _activations.map(
      (activation) => activation.arraySync() as number[][]
    )
    return activations
  }, [model, input])
}

const LAYER_SPACING = 11

type OutputOrient = "horizontal" | "vertical"
export const OUTPUT_ORIENT: OutputOrient = "vertical"

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
      type === "output"
        ? getLineYZ(i, units, OUTPUT_ORIENT)
        : getGridYZ(i, units, type)
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

function getLineYZ(
  i: number,
  total: number,
  orient: OutputOrient = "vertical"
): [number, number] {
  const NEURON_SPACING = 3
  const offsetY = (total - 1) * NEURON_SPACING * -0.5
  const factor = orient === "vertical" ? -1 : 1 // reverse
  const y = (i * NEURON_SPACING + offsetY) * factor
  const z = 0
  return orient === "vertical" ? ([y, z] as const) : ([z, y] as const)
}
