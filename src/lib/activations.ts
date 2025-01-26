import * as tf from "@tensorflow/tfjs"
import { useMemo } from "react"
import type { LayerInput } from "./datasets"
import { debug } from "@/lib/_debug"
import { normalizeTensor } from "./normalization"

export function useActivations(
  isPending: boolean,
  model?: tf.LayersModel,
  input?: LayerInput
) {
  return useMemo(() => {
    if (isPending || !model || !input || input.length === 0) return []
    const startTime = Date.now()
    // TODO: handle multi-dimensional input without flattening

    const shape = model.layers[0].batchInputShape
    const [, ...dims] = shape as number[]

    const result = tf.tidy(() => {
      // Define a model that outputs activations for each layer
      const layerOutputs = model.layers.flatMap((layer) => layer.output)
      // Create a new model that will return the activations
      const activationModel = tf.model({
        inputs: model.input,
        outputs: layerOutputs,
      })

      const tensor = tf.tensor([input], [1, ...dims])
      // Get the activations for each layer
      const _activations = activationModel.predict(
        tensor
      ) as tf.Tensor<tf.Rank>[]

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
  }, [isPending, model, input])
}
