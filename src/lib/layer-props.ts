import { createRef, useMemo } from "react"
import * as tf from "@tensorflow/tfjs"
import { normalize } from "./normalization"
import { Index3D, Neuron, NeuronRefType, Nid } from "@/components/neuron"
import { Dataset } from "./datasets"
import { LayerLayout } from "./layer-layout"
import { LayerDef } from "@/components/layer"
import { DEBUG } from "@/lib/_debug"

// TODO: fix rawInput

export type LayerPosition = "input" | "hidden" | "output" | "invisible"
export type Point = [number, number, number]

type NeuronStem = {
  nid: Nid
  index: number
  index3d: Index3D
  layerIndex: number
  ref: React.RefObject<NeuronRefType>
  _inputNids: Nid[] // temporary, will be replaced by inputNeurons later
}

export function useLayerProps(
  model: tf.LayersModel | undefined,
  ds: Dataset | undefined,
  layerLayouts: LayerLayout[],
  activations: number[][]
  // rawInput?: LayerInput
) {
  const neuronStems: NeuronStem[][] = useMemo(() => {
    return (
      model?.layers.map((layer, layerIndex) => {
        const units = getUnits(layer)
        const prevLayer = model.layers[layerIndex - 1]
        const layerInputNids = getInputNeurons(layer, layerIndex, prevLayer)
        return Array.from({ length: units }).map((_, index) => {
          const outputShape = layer.outputShape as number[]
          const index3d = getNeuronIndex3d(index, outputShape)
          return {
            nid: getNid(layerIndex, index3d),
            index,
            index3d,
            layerIndex,
            _inputNids: layerInputNids?.[index] ?? [],
            ref: createRef<NeuronRefType>(),
          }
        })
      }) ?? []
    )
  }, [model])
  const layerProps = useMemo(() => {
    if (!model) return []
    const startTime = Date.now()
    const weightsAndBiases = getWeightsAndBiases(model)
    const visibleLayers = model.layers.filter((l) => getUnits(l))
    const result = model.layers.reduce((acc, l, i) => {
      const outputShape = l.outputShape as number[] // [batch, height, width, channels]
      const visibleIndex = visibleLayers.indexOf(l)
      const { geometry, spacing, positions: neuronPositions } = layerLayouts[i]
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
      // TODO: use tensors?
      const { weights, biases } = weightsAndBiases[i]
      const flattenedWeights = weights?.flat(2)
      const type = l.getClassName()
      const prevLayer = acc[i - 1]
      const neurons: Neuron[] = neuronStems[i].map((neuronStem, j) => {
        const activation = layerActivations?.[j]
        let bias: number | undefined = undefined
        let thisWeights: number[] = []
        if (["Conv2D", "MaxPooling2D"].includes(type)) {
          const [_bias, _thisWeights] = getConv2DState(
            l,
            j,
            biases,
            flattenedWeights
          )
          bias = _bias
          thisWeights = _thisWeights ?? []
        } else {
          // Dense (flat)
          bias = biases?.[j]
          // thisWeights = weights?.map((w) => w[j]) as number[]
          if (weights) {
            for (let i = 0; i < weights.length; i++) {
              thisWeights[i] = weights[i][j] as number
            }
          }
        }
        return {
          ...neuronStem,
          visibleLayerIndex: visibleIndex,
          position: neuronPositions?.[j] ?? [0, 0, 0],
          activation,
          normalizedActivation: normalizedActivations?.[j],
          hasColorChannels: layerPosition === "input" && outputShape[3] > 1,
          prevLayer,
          bias,
          label:
            layerPosition === "output"
              ? ds?.output.labels?.[j]
              : layerPosition === "input"
              ? ds?.input?.labels?.[j]
              : undefined,
          inputNeurons: neuronStem._inputNids
            ?.map((nid) => prevLayer?.neuronsMap?.get(nid))
            .filter(Boolean) as Neuron[],
          weights: thisWeights,
          inputs: inputs,
          /* 
          prevLayer,
          ds, */
        }
      })
      const layer = {
        index: i,
        visibleIndex,
        layerPosition,
        tfLayer: l,
        prevLayer,
        neurons,
        neuronsMap: new Map(neurons.map((n) => [n.nid, n])),
        geometry,
        spacing,
        ds,
      }
      return [...acc, layer]
    }, [] as LayerDef[])
    const endTime = Date.now()
    if (DEBUG)
      console.log(`LayerProps took ${endTime - startTime}ms`, { result })
    return result
  }, [activations, model, ds, layerLayouts, neuronStems])
  const neuronRefs = neuronStems.map((layer) => layer.map((n) => n.ref))
  return [layerProps, neuronRefs] as const
}

function getNid(layerIndex: number, index3d: Index3D) {
  return `${layerIndex}_${index3d.join(".")}` as Nid
}

export function getNeuronFromNidInLayer(nid: Nid, layer?: LayerDef) {
  return layer?.neurons.find((n) => n.nid === nid)
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

function getInputNeurons(
  l: tf.layers.Layer,
  layerIndex: number,
  prevLayer: tf.layers.Layer | undefined
): Nid[][] {
  // TODO: adapt for dense as well
  if (l.getClassName() !== "Conv2D" && l.getClassName() !== "MaxPooling2D")
    return []
  if (layerIndex === 0 || !prevLayer) return []

  // the receptive field
  const [filterHeight, filterWidth] =
    (l.getConfig().kernelSize as number[]) ??
    (l.getConfig().poolSize as number[]) ??
    ([] as number[])
  const [strideHeight, strideWidth] = (l.getConfig().strides as number[]) ?? [
    1, 1,
  ]
  const filterSize = filterHeight * filterWidth

  const outputShape = l.outputShape as number[]
  const prevOutputShape = prevLayer.outputShape as number[]
  const depth = prevOutputShape[3]

  const units = getUnits(l)

  const inputNids: Nid[][] = []
  // TODO: padding?
  for (let j = 0; j < units; j++) {
    const unitInputNids: Nid[] = []
    for (let k = 0; k < filterSize * depth; k++) {
      const [thisY, thisX, thisDepth] = getNeuronIndex3d(j, outputShape)
      const depthIndex = k % depth
      if (l.getClassName() === "MaxPooling2D" && depthIndex !== thisDepth)
        continue
      const widthIndex =
        thisX * strideWidth + (Math.floor(k / depth) % filterWidth)
      const heightIndex =
        thisY * strideHeight + Math.floor(k / (depth * filterWidth))
      const index3d = [heightIndex, widthIndex, depthIndex] as Index3D
      const inputNid = getNid(layerIndex - 1, index3d)
      if (!inputNid) {
        console.warn("no inputNid", { layerIndex, index3d })
        continue
      }
      unitInputNids.push(inputNid)
    }
    inputNids.push(unitInputNids)
  }
  return inputNids
}

function getConv2DState(
  l: tf.layers.Layer,
  j: number, // neuron index
  biases?: number[],
  flattenedWeights?: (number | number[])[]
) {
  // return [undefined, undefined] as const

  let bias: number | undefined = undefined
  let thisWeights: number[] | undefined = undefined

  // Conv2D (multi-dim)
  const filters = (l.getConfig().filters as number) ?? 1
  const filterIndex = j % filters
  // parameter sharing: 1 bias per filter + [filterSize] weights
  bias = biases?.[filterIndex]
  thisWeights = flattenedWeights
    ?.map((w: number | number[]) =>
      Array.isArray(w) ? w?.[filterIndex] : undefined
    )
    .filter((v) => v !== undefined) as number[]

  return [bias, thisWeights] as const
}
