import { createRef, useMemo } from "react"
import * as tf from "@tensorflow/tfjs"
import { normalize } from "./normalization"
import {
  Index3D,
  NeuronDef,
  NeuronRefType,
  NeuronState,
  NodeId,
} from "@/components/neuron"
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
    return (
      model?.layers.map((layer) => {
        const units = getUnits(layer)
        return Array.from({ length: units }).map(() =>
          createRef<NeuronRefType>()
        )
      }) ?? []
    )
  }, [model])
  const layerProps = useMemo(() => {
    if (!model) return []
    const startTime = Date.now()
    const weightsAndBiases = getWeightsAndBiases(model)
    const visibleLayers = model.layers.filter((l) => getUnits(l))
    const result = model.layers.map((l, i) => {
      const outputShape = l.outputShape as number[] // [batch, height, width, channels]
      const prevLayer = model.layers[i - 1]
      const prevOutputShape = prevLayer?.outputShape as number[] | undefined
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
      const flattenedWeights = weights?.flat(2)
      const neurons: (NeuronDef & NeuronState)[] = Array.from({
        length: units,
      }).map((_, j) => {
        const activation = layerActivations?.[j]
        let bias: number | undefined = undefined
        let thisWeights: number[] | undefined
        let inputNeurons: NodeId[] | undefined = undefined
        if (l.getClassName() === "Conv2D") {
          // Conv2D (multi-dim)
          const filters = (l.getConfig().filters as number) ?? 1
          const [filterHeight, filterWidth] =
            (l.getConfig().kernelSize as number[]) ?? ([] as number[])
          const filterSize = filterHeight * filterWidth
          const kernelIndex = j % filters
          // parameter sharing: 1 bias per filter + [filterSize] weights
          bias = biases?.[kernelIndex]
          thisWeights = flattenedWeights
            ?.map((w: number | number[]) =>
              Array.isArray(w) ? w?.[kernelIndex] : undefined
            )
            .filter((v) => v !== undefined) as number[]
          if (prevOutputShape) {
            const depth = prevOutputShape[3]
            // TODO: padding?

            const [thisY, thisX] = getNeuronIndex3d(j, outputShape)
            for (let k = 0; k < filterSize * depth; k++) {
              const depthIndex = k % depth
              const widthIndex = thisX + (Math.floor(k / depth) % filterWidth)
              const heightIndex = thisY + Math.floor(k / (depth * filterWidth))
              const index3d = [heightIndex, widthIndex, depthIndex] as Index3D
              const inputNid = getNid(i - 1, index3d)
              if (!inputNeurons) inputNeurons = [] as NodeId[]
              inputNeurons.push(inputNid)
            }
          }
        } else {
          // Dense (flat)
          bias = biases?.[j]
          thisWeights = weights?.map((w) => w[j]) as number[]
        }
        const index3d = getNeuronIndex3d(j, outputShape)
        return {
          nid: getNid(i, index3d),
          index: j,
          index3d: getNeuronIndex3d(j, outputShape),
          layerIndex: i,
          visibleLayerIndex: visibleIndex,
          position: neuronPositions?.[j] ?? [0, 0, 0],
          ref: neuronRefs?.[i]?.[j] ?? createRef<NeuronRefType>(),
          rawInput: layerPosition === "input" ? rawInput?.[j] : undefined,
          activation,
          normalizedActivation: normalizedActivations?.[j],
          inputNeurons,
          inputs: inputs,
          weights: thisWeights,
          bias,
          label:
            layerPosition === "output"
              ? ds?.output.labels?.[j]
              : layerPosition === "input"
              ? ds?.input?.labels?.[j]
              : undefined,
          hasColorChannels: layerPosition === "input" && outputShape[3] > 1,
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
  return [layerProps, neuronRefs] as const
}

function getNid(layerIndex: number, index3d: Index3D) {
  return `${layerIndex}_${index3d.join(".")}`
}

function getNeuronIndex3d(flatIndex: number, outputShape: number[]) {
  const [, , width = 1, depth = 1] = outputShape
  const depthIndex = flatIndex % depth
  const widthIndex = Math.floor(flatIndex / depth) % width
  const heightIndex = Math.floor(flatIndex / (depth * width))
  return [heightIndex, widthIndex, depthIndex] as Index3D
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
  const [, ...dims] = layer.outputShape as number[] // [batch, height, width, channels]
  const flattenedNumber = dims.reduce((a, b) => a * b, 1)
  return flattenedNumber
}

function getWeightsAndBiases(model: tf.LayersModel) {
  return model.layers.map((layer) => {
    const [weights, biases] = layer.getWeights().map((w) => w.arraySync())
    return { weights, biases } as {
      weights: number[][] | number[][][] | number[][][][] | undefined
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
