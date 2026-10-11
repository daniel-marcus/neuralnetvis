import * as tf from "@tensorflow/tfjs"
import type { Layer } from "@tensorflow/tfjs-layers/dist/exports_layers"
import type { WeightsBiases } from "./types"

// cache for the last layer only (hovering / selecting neurons of the same layer), weights can be large
let cached: { layer: Layer; dataIds: object[]; result: WeightsBiases } | undefined

export function getLayerWeights(layer: Layer) {
  // variables get a new dataId when their value changes (training, setWeights)
  const dataIds = layer.weights.map((w) => w.read().dataId)
  if (cached?.layer === layer && cached.dataIds.length === dataIds.length) {
    if (cached.dataIds.every((id, i) => id === dataIds[i])) return cached.result
  }
  const result = tf.tidy(() => {
    const [_weights, _biases] = layer.getWeights()
    const numWeights = _weights?.shape[_weights?.shape.length - 1]
    const weights = _weights?.transpose().reshape([numWeights, -1]).arraySync() as number[][]
    const biases = _biases?.arraySync() as number[] | undefined
    return { weights, biases }
  }) as WeightsBiases
  cached = { layer, dataIds, result }
  return result
}

const MAX_CACHED_WEIGHTS = 1_000_000 // larger kernels: read the weights of single neurons only

type NeuronWeights = { weights?: number[]; bias?: number }

let cachedNeuron: { layer: Layer; dataId: object; idx: number; result: NeuronWeights } | undefined

// weights and bias of a single neuron / filter
export function getNeuronWeights(layer: Layer, idx: number): NeuronWeights {
  const kernel = layer.weights[0]?.read()
  if (!kernel || kernel.size <= MAX_CACHED_WEIGHTS) {
    const { weights, biases } = getLayerWeights(layer)
    return { weights: weights?.[idx], bias: biases?.[idx] }
  }
  const { dataId } = kernel
  if (cachedNeuron?.layer === layer && cachedNeuron.dataId === dataId && cachedNeuron.idx === idx) {
    return cachedNeuron.result
  }
  const result = tf.tidy(() => {
    const [_weights, _biases] = layer.getWeights()
    // same order as a row in getLayerWeights
    const row = _weights.gather([idx], _weights.shape.length - 1).transpose()
    const weights = Array.from(row.dataSync())
    const bias = _biases?.gather([idx]).dataSync()[0]
    return { weights, bias }
  }) as NeuronWeights
  cachedNeuron = { layer, dataId, idx, result }
  return result
}
