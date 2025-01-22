import React, { useMemo } from "react"
import { Dense, type DenseProps } from "./dense"
import * as tf from "@tensorflow/tfjs"
import type { DataType, Dataset } from "@/lib/datasets"
import { normalizeWithSign, normalize } from "@/lib/normalization"
import { NeuronState } from "./neuron"
import { useNodeSelect } from "@/lib/node-select"

export type LayerProps = DenseProps
export type LayerPosition = "input" | "hidden" | "output"
export type Point = [number, number, number]

interface SequentialProps {
  model: tf.LayersModel
  ds: Dataset
  input?: DataType[]
  rawInput?: DataType[]
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
  const layerProps = useMemo(() => {
    const weightsAndBiases = getWeightsAndBiases(model)
    return model.layers.map((l, i) => {
      const units = getUnits(l)
      const layerPosition = getLayerPosition(model.layers.length, i)
      const layerActivations = activations?.[i]
      const normalizedActivations =
        layerPosition === "output"
          ? layerActivations
          : normalize(layerActivations)
      const { weights, biases } = weightsAndBiases[i]

      const neurons: (NeuronState & {
        nid: string
        index: number
        layerIndex: number
      })[] = Array.from({
        length: units,
      }).map((_, j) => {
        const activation = layerActivations?.[j]
        const bias = biases?.[j]
        const thisWeights = weights?.map((w) => w[j])
        const prevActivations = activations?.[i - 1]
        const weightedInputs = prevActivations?.map(
          (a, k) => a * (thisWeights?.[k] ?? 0)
        )
        return {
          nid: `${i}_${j}`,
          index: j,
          layerIndex: i,
          rawInput: layerPosition === "input" ? rawInput?.[j] : undefined,
          activation,
          normalizedActivation: normalizedActivations?.[j],
          weights: thisWeights,
          normalizedWeights: normalizeWithSign(thisWeights),
          bias,
          weightedInputs,
          label:
            layerPosition === "output"
              ? ds.output.labels?.[j]
              : layerPosition === "input"
              ? ds.input?.labels?.[j]
              : undefined,
          ds,
        }
      })
      const layer = {
        index: i,
        layerPosition,
        neurons,
        positions: neuronPositions[i],
        ds,
      }
      return layer
    })
  }, [activations, model, ds, rawInput, neuronPositions])
  const patchedLayerProps = useNodeSelect(layerProps)
  return (
    <group>
      {patchedLayerProps.map((props, i) => (
        <Dense key={i} {...props} allLayers={layerProps} />
      ))}
    </group>
  )
}

function getUnits(layer: tf.layers.Layer) {
  return (layer.getConfig().units as number) ?? layer.batchInputShape?.[1] ?? 0
}

function getWeightsAndBiases(model: tf.LayersModel) {
  return model.layers.map((layer) => {
    const [weights, biases] = layer.getWeights().map((w) => w.arraySync())
    return { weights, biases } as {
      weights: number[][] | undefined
      biases: number[] | undefined
    }
  })
}

function useActivations(model: tf.LayersModel, input?: DataType[]) {
  return useMemo(() => {
    if (!model || !input || input.length === 0) return []

    // TODO: handle multi-dimensional input without flattening

    const isMultiDim = Array.isArray(input[0])

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
      (activation) => activation.arraySync() as (number | number[])[][]
    )
    // TODO: handle multi-dimensional output!!
    const result = isMultiDim
      ? activations.map((a) => a[0]).map((a) => a[0]) // use only the first channel so far ...
      : activations.map((a) => a[0])
    return result as number[][] // single activations for each layer and neuron
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
