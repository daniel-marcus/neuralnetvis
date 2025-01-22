import React, { useContext, useMemo } from "react"
import { Dense, type DenseProps } from "./dense"
import * as tf from "@tensorflow/tfjs"
import type { Dataset, LayerInput } from "@/lib/datasets"
import { normalizeWithSign, normalize } from "@/lib/normalization"
import { NeuronState } from "./neuron"
import { useNodeSelect } from "@/lib/node-select"
import { useActivations } from "@/lib/activations"
import { OptionsContext } from "./model"

export type LayerProps = DenseProps
export type LayerPosition = "input" | "hidden" | "output"
export type Point = [number, number, number]

interface SequentialProps {
  model?: tf.LayersModel
  ds?: Dataset
  input?: LayerInput
  rawInput?: LayerInput
}

export const Sequential = ({ model, ds, input, rawInput }: SequentialProps) => {
  const splitColors = useContext(OptionsContext).splitColors
  const activations = useActivations(model, input)
  // const visibleLayers = useMemo(() => model.layers.filter(l => l.getClassName() !== ""), [model])
  const neuronPositions = useMemo(
    () => model?.layers.map((l) => getNeuronPositions(l, model, splitColors)),
    [model, splitColors]
  )
  const layerProps = useMemo(() => {
    if (!model) return []
    const weightsAndBiases = getWeightsAndBiases(model)
    const result = model.layers.map((l, i) => {
      const units = getUnits(l)
      const layerPosition = getLayerPosition(l, model)
      const layerActivations = activations?.[i]
      const normalizedActivations =
        layerPosition === "output"
          ? layerActivations
          : normalize(layerActivations)
      const { weights, biases } = weightsAndBiases[i]

      // TODO: expensive... call on demand?
      const inputs = activations?.[i - 1]
      const weightedInputs =
        inputs && weights ? getWeightedInputs(inputs, weights) : undefined

      const neurons: (NeuronState & {
        nid: string
        index: number
        layerIndex: number
        position: Point
      })[] = Array.from({
        length: units,
      }).map((_, j) => {
        const activation = layerActivations?.[j]
        const bias = biases?.[j]
        const thisWeights = weights?.map((w) => w[j])
        // const prevActivations = activations?.[i - 1]
        /* const _weightedInputs = prevActivations?.map(
          (a, k) => a * (thisWeights?.[k] ?? 0)
        ) // too expensive!  */
        return {
          nid: `${i}_${j}`,
          index: j,
          layerIndex: i,
          position: neuronPositions?.[i]?.[j] ?? [0, 0, 0],
          rawInput: layerPosition === "input" ? rawInput?.[j] : undefined,
          activation,
          normalizedActivation: normalizedActivations?.[j],
          weights: thisWeights,
          normalizedWeights: normalizeWithSign(thisWeights),
          bias,
          weightedInputs: weightedInputs?.[i],
          normalizedWeightedInputs: normalizeWithSign(weightedInputs?.[i]),
          label:
            layerPosition === "output"
              ? ds?.output.labels?.[j]
              : layerPosition === "input"
              ? ds?.input?.labels?.[j]
              : undefined,
          ds,
        }
      })
      const layer = {
        index: i,
        layerPosition,
        neurons,
        positions: neuronPositions?.[i],
        ds,
      }
      return layer
    })
    return result
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
  const unitsFromConfig = layer.getConfig().units as number
  if (unitsFromConfig) return unitsFromConfig
  else if (layer.batchInputShape) {
    // input layer
    // const [, ...dims] = layer.batchInputShape
    // const flattened = (dims as number[]).reduce((a, b) => a * b, 1)
    // const [width = 1, height = 1, channels = 1] = dims as number[]
    // const flattened = width * height * 1
    return 0
  } else {
    // flatten layer
    // return 0
    return typeof layer.outputShape[1] === "number" ? layer.outputShape[1] : 0
  }
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

function getWeightedInputs(layerInput: number[], weights: number[][]) {
  const weightedInputs = tf.tidy(() => {
    const weightsTensor = tf.tensor2d(weights)
    const transposedWeights = weightsTensor.transpose()
    const inputsTensor = tf.tensor2d(layerInput, [1, layerInput.length])
    return tf.mul(transposedWeights, inputsTensor).arraySync() as number[][]
  })
  return weightedInputs
}

const LAYER_SPACING = 11

type OutputOrient = "horizontal" | "vertical"
export const OUTPUT_ORIENT: OutputOrient = "vertical"

function getNeuronPositions(
  layer: tf.layers.Layer,
  model: tf.LayersModel,
  splitColors?: boolean
) {
  const visibleLayers = model.layers.filter((l) => getUnits(l))
  const layerIndex = visibleLayers.indexOf(layer)
  const totalLayers = visibleLayers.length
  const units = getUnits(layer)
  const type = getLayerPosition(layer, model)
  const offsetX =
    layerIndex * LAYER_SPACING + (totalLayers - 1) * LAYER_SPACING * -0.5
  const colorChannels = model.layers[0].batchInputShape?.[3] ?? 1
  const positions = Array.from({ length: units }).map((_, i) => {
    const [x, y, z] =
      type === "output"
        ? getLineXYZ(i, units, OUTPUT_ORIENT)
        : type === "input" && units <= 10
        ? getLineXYZ(i, units, "vertical")
        : type === "input"
        ? getGroupedGridXYZ(i, units, type, colorChannels, splitColors)
        : getGroupedGridXYZ(i, units, type)
    return [x + offsetX, y, z] as Point
  })
  return positions
}

function getLayerPosition(
  layer: tf.layers.Layer,
  model: tf.LayersModel
): LayerPosition {
  const index = model.layers.indexOf(layer)
  const totalLayers = model.layers.length
  const isInputFlatten = layer.getClassName() === "Flatten" && index === 1
  if (isInputFlatten || index === 0) return "input"
  if (index === totalLayers - 1) return "output"
  return "hidden"
}

function getGroupedGridXYZ(
  _i: number,
  _total: number,
  type: LayerPosition,
  groupSize = 1,
  split = false
): [number, number, number] {
  const total = Math.ceil(_total / groupSize)
  const i = Math.floor(_i / groupSize)
  const rest = _i % groupSize
  const gridSize = Math.ceil(Math.sqrt(total))
  const NEURON_SPACING = type === "input" ? 0.7 : 1.8
  const offsetY = (gridSize - 1) * NEURON_SPACING * 0.5
  const offsetZ = (gridSize - 1) * NEURON_SPACING * -0.5

  const y = -1 * Math.floor(i / gridSize) * NEURON_SPACING + offsetY // row
  const z = (i % gridSize) * NEURON_SPACING + offsetZ // column

  const shiftMatrix = split ? [0, 0, 2 * (offsetZ - NEURON_SPACING)] : [0, 0, 0]
  const [shiftX, shiftY, shiftZ] = shiftMatrix.map(
    (v) => -v * (rest - (groupSize - 1) / 2)
  )

  return [shiftX, y + shiftY, z + shiftZ] as const
}

function getLineXYZ(
  i: number,
  total: number,
  orient: OutputOrient = "vertical"
): [number, number, number] {
  const NEURON_SPACING = 3
  const offsetY = (total - 1) * NEURON_SPACING * -0.5
  const factor = orient === "vertical" ? -1 : 1 // reverse
  const y = (i * NEURON_SPACING + offsetY) * factor
  const z = 0
  return orient === "vertical" ? ([0, y, z] as const) : ([0, z, y] as const)
}
