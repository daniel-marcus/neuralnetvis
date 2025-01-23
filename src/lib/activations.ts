import * as tf from "@tensorflow/tfjs"
import { useMemo } from "react"
import type { LayerInput } from "./datasets"

export function useActivations(model?: tf.LayersModel, input?: LayerInput) {
  return useMemo(() => {
    if (!model || !input || input.length === 0) return []
    // TODO: handle multi-dimensional input without flattening

    const result = tf.tidy(() => {
      // Define a model that outputs activations for each layer
      const layerOutputs = model.layers.flatMap((layer) => layer.output)
      // Create a new model that will return the activations
      const activationModel = tf.model({
        inputs: model.input,
        outputs: layerOutputs,
      })

      const shape = model.layers[0].batchInputShape
      const [, ...dims] = shape as number[]

      const tensor = tf.tensor([input], [1, ...dims])
      // Get the activations for each layer
      const _activations = activationModel.predict(
        tensor
      ) as tf.Tensor<tf.Rank>[]

      const activations = _activations.map(
        (activation) => activation.arraySync() as (number | number[])[][]
      )
      // TODO: handle multi-dimensional output!!
      return activations.map((a) => a[0])
    })
    return result as number[][] // single activations for each layer and neuron
  }, [model, input])
}
