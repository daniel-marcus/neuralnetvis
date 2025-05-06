import * as tf from "@tensorflow/tfjs"
import type { Layer } from "@tensorflow/tfjs-layers/dist/exports_layers"
import type { WeightsBiases } from "./types"

export function getLayerWeights(layer: Layer) {
  // TODO: cache in store?
  const result = tf.tidy(() => {
    const [_weights, _biases] = layer.getWeights()
    const numWeights = _weights?.shape[_weights?.shape.length - 1]
    const weights = _weights
      ?.transpose()
      .reshape([numWeights, -1])
      .arraySync() as number[][]
    const biases = _biases?.arraySync() as number[] | undefined
    return { weights, biases }
  })
  return result as WeightsBiases
}
