import * as tf from "@tensorflow/tfjs"
import { useMemo } from "react"
import type { LayerInput } from "./datasets"
import { debug } from "@/lib/debug"
import { normalizeTensor } from "./normalization"

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
        const reshaped = layerActivation.reshape([-1])
        return {
          activations: reshaped.arraySync() as number[],
          normalizedActivations: normalizeTensor(
            reshaped
          ).arraySync() as number[],
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
