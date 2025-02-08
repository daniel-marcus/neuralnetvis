import * as tf from "@tensorflow/tfjs"
import { useEffect } from "react"
import { debug } from "@/lib/debug"
import {
  normalizeConv2DActivations,
  normalizeTensor,
} from "../data/normalization"
import { create } from "zustand"

interface LayerActivations {
  activations: number[] // [neuronIdx]
  normalizedActivations: number[]
}

interface ActivationStore {
  layerActivations: LayerActivations[]
  setLayerActivations: (layerActivations: LayerActivations[]) => void
}

export const useActivationStore = create<ActivationStore>((set) => ({
  layerActivations: [],
  setLayerActivations: (layerActivations) => set(() => ({ layerActivations })),
}))

export function useActivations(model?: tf.LayersModel, input?: number[]) {
  const layerActivations = useActivationStore((s) => s.layerActivations)
  const setLayerActivations = useActivationStore((s) => s.setLayerActivations)
  useEffect(() => {
    async function getActivations() {
      if (!model || !input || input.length === 0) return
      const startTime = Date.now()

      const shape = model.layers[0].batchInputShape
      const [, ...dims] = shape as number[]

      const activationTensors = tf.tidy(() => {
        const tmpModel = tf.model({
          inputs: model.input,
          outputs: model.layers.flatMap((layer) => layer.output),
        })
        const tensor = tf.tensor([input], [1, ...dims])
        // note: predictAsync method not available for tf.LayersModel
        const _activations = tmpModel.predict(tensor) as tf.Tensor<tf.Rank>[]
        const activations = _activations.map((layerActivation) => {
          const { shape } = layerActivation
          const flattened = layerActivation.reshape([-1]) as tf.Tensor1D
          const [, , , depth] = shape
          const hasDepthDim = depth > 1
          const normalizedFlattened = hasDepthDim // TODO: refactor: one function for all cases
            ? normalizeConv2DActivations(
                layerActivation as tf.Tensor4D
              ).reshape([-1])
            : normalizeTensor(flattened)
          return [
            flattened, // .arraySync() as number[],
            normalizedFlattened, // .arraySync() as number[],
          ]
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

      const endTime = Date.now()
      if (debug())
        console.log("Activations computed in", endTime - startTime, "ms")
    }
    getActivations()
  }, [model, input, setLayerActivations])
  return layerActivations
}
