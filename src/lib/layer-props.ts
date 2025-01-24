import { createRef, useMemo } from "react"
import * as tf from "@tensorflow/tfjs"
import { normalize } from "./normalization"
import { NeuronDef, NeuronRefType, NeuronState } from "@/components/neuron"
import { Dataset, LayerInput } from "./datasets"
import { LayerLayout } from "./layer-layout"
import { LayerDef } from "@/components/layer"

const DEBUG = true

// TODO: fix rawInput

export type LayerPosition = "input" | "hidden" | "output" | "invisible"
export type Point = [number, number, number]

export function useLayerProps(
  model: tf.LayersModel | undefined,
  ds: Dataset | undefined,
  layerLayouts: LayerLayout[],
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
    const visibleLayers = model.layers.filter((l) => getUnits(l))
    const result = model.layers.map((l, i) => {
      const visibleIndex = visibleLayers.indexOf(l)
      const { geometry, spacing, positions: neuronPositions } = layerLayouts[i]
      const units = getUnits(l)
      const layerPosition = getLayerPosition(l, model)
      const _layerActivations = activations?.[i]
      const layerActivations = Array.isArray(_layerActivations?.[0])
        ? _layerActivations.flat(2) // TODO: make dimensions flexible?
        : _layerActivations
      const normalizedActivations =
        layerPosition === "output"
          ? layerActivations
          : normalize(layerActivations)
      const _inputs = activations?.[i - 1]
      const inputs = Array.isArray(_inputs?.[0])
        ? _inputs.flat(2) // TODO: make dimensions flexible?
        : _inputs
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
          visibleLayerIndex: visibleIndex,
          position: neuronPositions?.[j] ?? [0, 0, 0],
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
        visibleIndex,
        layerPosition,
        tfLayer: l,
        neurons,
        geometry,
        spacing,
        ds,
      }
      return layer
    })
    const endTime = Date.now()
    if (DEBUG)
      console.log(`LayerProps took ${endTime - startTime}ms`, { result })
    return result
  }, [activations, model, ds, rawInput, layerLayouts, neuronRefs])
  return layerProps
}

export function getVisibleLayers(allLayers: LayerDef[]) {
  return allLayers.filter((l) => l.neurons.length)
}

export function getUnits(layer: tf.layers.Layer) {
  const unitsFromConfig = layer.getConfig().units as number
  if (unitsFromConfig) {
    // dense
    return unitsFromConfig
  } else if (layer.batchInputShape) {
    // input layer
    const [, ...dims] = layer.batchInputShape
    const flattenedNumber = (dims as number[]).reduce((a, b) => a * b, 1)
    return flattenedNumber
  } else if (layer.getClassName() === "Flatten") {
    // flatten layer
    // eturn typeof layer.outputShape[1] === "number" ? layer.outputShape[1] : 0
    return 0
  }
  // Conv2D, MaxPooling2D, etc.
  const [, width, height, channels] = layer.outputShape as number[]
  const flattenedNumber = [width, height, channels].reduce((a, b) => a * b, 1)
  return flattenedNumber
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
  if (index === 0) return "input"
  if (index === totalLayers - 1) return "output"
  if (getUnits(layer) === 0) return "invisible"
  return "hidden"
}
