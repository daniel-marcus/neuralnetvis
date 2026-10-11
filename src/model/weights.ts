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
