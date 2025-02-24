import * as tf from "@tensorflow/tfjs"
import { useEffect } from "react"
import { useStore } from "@/store"
import { normalizeConv2DActivations, normalizeTensor } from "@/data/utils"
import { LayerActivations } from "./types"

export function useActivations(model?: tf.LayersModel, input?: number[]) {
  const layerActivations = useStore((s) => s.layerActivations)
  const setLayerActivations = useStore((s) => s.setLayerActivations)
  useEffect(() => {
    async function getActivations() {
      if (!model || !input || input.length === 0) return

      const shape = model.layers[0].batchInputShape
      const [, ...dims] = shape as number[]
      const valsPerSample = dims.reduce((a, b) => a * b, 1)
      if (input.length !== valsPerSample) {
        console.log(
          `Sample shape does not match model input shape. Provided values: ${
            input.length
          }, expected: ${valsPerSample} (${dims.join("x")})`
        )
        return
      }

      const activationTensors = tf.tidy(() => {
        const tmpModel = tf.model({
          inputs: model.input,
          outputs: model.layers.flatMap((layer) => layer.output),
        })
        const tensor = tf.tensor([input], [1, ...dims])
        // note: predictAsync method not available for tf.LayersModel
        const _activations = tmpModel.predict(tensor) as
          | tf.Tensor<tf.Rank>[]
          | tf.Tensor<tf.Rank>
        const layerActivations = Array.isArray(_activations)
          ? _activations
          : [_activations]
        const activations = layerActivations.map((layerActivation) => {
          const { shape } = layerActivation
          const flattened = layerActivation.reshape([-1]) as tf.Tensor1D
          const [, , , depth] = shape
          const hasDepthDim = depth > 1
          const normalizedFlattened = hasDepthDim // TODO: refactor: one function for all cases
            ? normalizeConv2DActivations(
                layerActivation as tf.Tensor4D
              ).reshape([-1])
            : normalizeTensor(flattened)
          return [flattened, normalizedFlattened]
        })
        return activations
      })

      try {
        const newLayerActivations: LayerActivations[] = []
        for (const [actTensor, normActTensor] of activationTensors) {
          const act = (await actTensor.array()) as number[]
          const normAct = (await normActTensor.array()) as number[]
          newLayerActivations.push({
            activations: act,
            normalizedActivations: normAct,
          })
        }
        setLayerActivations(newLayerActivations)
      } catch (e) {
        console.log("Error getting activations", e)
      } finally {
        activationTensors.flat().forEach((t) => t.dispose())
      }
    }
    getActivations()
  }, [model, input, setLayerActivations])
  return layerActivations
}
