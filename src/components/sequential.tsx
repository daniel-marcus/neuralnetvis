import React, { useMemo } from "react"
import { Dense, type DenseProps } from "./dense"
import * as tf from "@tensorflow/tfjs"
import { type Dataset, normalize } from "@/lib/datasets"

export type LayerProps = DenseProps
export type LayerPosition = "input" | "hidden" | "output"
export type Point = [number, number, number]

interface SequentialProps {
  model: tf.LayersModel
  ds: Dataset
  input?: number[]
  rawInput?: number[]
}

export const Sequential = ({ model, ds, input, rawInput }: SequentialProps) => {
  const activations = useActivations(model, input)
  const neuronPositions = useMemo(
    () =>
      model.layers.map((l, i) =>
        getNeuronPositions(i, model.layers.length, getUnits(l))
      ),
    [model]
  )
  const layerProps = useMemo(
    () =>
      model.layers.map((l, i) => {
        const layerPosition = getLayerPosition(model.layers.length, i)
        const layerActivations = activations?.[i]
        // TODO: normalize on column?
        const normalizedActivations =
          layerPosition === "output"
            ? layerActivations
            : normalize(layerActivations)
        return {
          index: i,
          layerPosition,
          units: getUnits(l),
          rawInput: layerPosition === "input" ? rawInput : undefined,
          activations: layerActivations,
          normalizedActivations,
          weights: getWeights(l),
          biases: getBiases(l),
          positions: neuronPositions[i],
          ds,
        }
      }),
    [activations, model, ds, rawInput, neuronPositions]
  )
  return (
    <group>
      {layerProps.map((props, i) => (
        <Dense key={i} {...props} prevLayer={layerProps[i - 1]} />
      ))}
    </group>
  )
}

function getUnits(layer: tf.layers.Layer) {
  return (layer.getConfig().units as number) ?? layer.batchInputShape?.[1] ?? 0
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
    return activations.map((a) => a[0])
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
  const type = getLayerPosition(totalLayers, layerIndex)
  const offsetX =
    layerIndex * LAYER_SPACING + (totalLayers - 1) * LAYER_SPACING * -0.5
  const positions = Array.from({ length: units }).map((_, i) => {
    const x = offsetX
    const [y, z] =
      type === "output"
        ? getLineYZ(i, units, OUTPUT_ORIENT)
        : type === "input" && units <= 10
        ? getLineYZ(i, units, "vertical")
        : getGridYZ(i, units, type)
    return [x, y, z] as Point
  })
  return positions
}

export function getLayerPosition(
  totalLayers: number,
  index: number
): LayerPosition {
  if (index === 0) return "input"
  if (index === totalLayers - 1) return "output"
  return "hidden"
}

function getGridYZ(
  i: number,
  total: number,
  type: LayerPosition
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
