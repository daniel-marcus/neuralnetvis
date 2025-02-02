import * as tf from "@tensorflow/tfjs"
import { useMemo } from "react"
import type { LayerInput } from "./datasets"
import { debug } from "@/lib/debug"
import { normalizeConv2DActivations, normalizeTensor } from "./normalization"

export function useActivations(model?: tf.LayersModel, input?: LayerInput) {
  // TODO: use async .array() method?
  return useMemo(() => {
    if (!model || !input || input.length === 0) return []
    const startTime = Date.now()

    const shape = model.layers[0].batchInputShape
    const [, ...dims] = shape as number[]

    const result = tf.tidy(() => {
      const tmpModel = tf.model({
        inputs: model.input,
        outputs: model.layers.flatMap((layer) => layer.output),
      })

      const tensor = tf.tensor([input], [1, ...dims])

      const _activations = tmpModel.predict(tensor) as tf.Tensor<tf.Rank>[]

      const activations = _activations.map((layerActivation) => {
        const { shape } = layerActivation
        const flattened = layerActivation.reshape([-1]) as tf.Tensor1D
        const [, , , depth] = shape
        const hasDepthDim = depth > 1
        const normalizedFlattened = hasDepthDim // TODO: refactor: one function for all cases
          ? normalizeConv2DActivations(layerActivation as tf.Tensor4D).reshape([
              -1,
            ])
          : normalizeTensor(flattened)
        return {
          activations: flattened.arraySync() as number[],
          normalizedActivations: normalizedFlattened.arraySync() as number[],
        }
      })
      return activations
    })
    const endTime = Date.now()
    if (debug())
      console.log("Activations computed in", endTime - startTime, "ms")
    return result
  }, [model, input])
}
