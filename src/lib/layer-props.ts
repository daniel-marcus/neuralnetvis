import { createRef, useMemo } from "react"
import * as tf from "@tensorflow/tfjs"
import { normalize } from "./normalization"
import { NeuronDef, NeuronRefType, NeuronState } from "@/components/neuron"
import { Dataset, LayerInput } from "./datasets"

const DEBUG = false

// TODO: fix rawInput

export type LayerPosition = "input" | "hidden" | "output"
export type Point = [number, number, number]

export function useLayerProps(
  model: tf.LayersModel | undefined,
  ds: Dataset | undefined,
  neuronPositions: [number, number, number][][] | undefined,
  activations: number[][],
  rawInput?: LayerInput
) {
  const neuronRefs = useMemo(() => {
    return model?.layers.map((layer) => {
      const units = getUnits(layer)
      return Array.from({ length: units }).map(() => createRef<NeuronRefType>())
    })
  }, [model])
  const layerProps = useMemo(() => {
    if (!model) return []
    const startTime = Date.now()
    const weightsAndBiases = getWeightsAndBiases(model)
    const result = model.layers.map((l, i) => {
      const units = getUnits(l)
      const layerPosition = getLayerPosition(l, model)
      const layerActivations = activations?.[i]
      const normalizedActivations =
        layerPosition === "output"
          ? layerActivations
          : normalize(layerActivations)
      const inputs = activations?.[i - 1]
      const { weights, biases } = weightsAndBiases[i]

      const neurons: (NeuronDef & NeuronState)[] = Array.from({
        length: units,
      }).map((_, j) => {
        const activation = layerActivations?.[j]
        const bias = biases?.[j]
        const thisWeights = weights?.map((w) => w[j])
        return {
          nid: `${i}_${j}`,
          index: j,
          layerIndex: i,
          position: neuronPositions?.[i]?.[j] ?? [0, 0, 0],
          ref: neuronRefs?.[i]?.[j] ?? createRef<NeuronRefType>(),
          rawInput: layerPosition === "input" ? rawInput?.[j] : undefined,
          activation,
          normalizedActivation: normalizedActivations?.[j],
          inputs: inputs,
          weights: thisWeights,
          bias,
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
    const endTime = Date.now()
    if (DEBUG) console.log("LayerProps time:", endTime - startTime)
    return result
  }, [activations, model, ds, rawInput, neuronPositions, neuronRefs])
  return layerProps
}

export function getUnits(layer: tf.layers.Layer) {
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

export function getLayerPosition(
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
