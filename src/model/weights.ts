import * as tf from "@tensorflow/tfjs"
import { useEffect, useState } from "react"
import { useGlobalStore } from "@/store"
import type { WeightsBiases } from "./types"

export function useWeights(model?: tf.LayersModel) {
  const [weightsBiases, setWeightsBiases] = useState<WeightsBiases[]>([])
  const batchCount = useGlobalStore((s) => s.batchCount) // used to trigger updates after/during training
  useEffect(() => {
    if (!model) return
    async function updateWeights() {
      if (!model) return
      const _newStates = model.layers.map((l) => {
        return tf.tidy(() => {
          const [_weights, biases] = l.getWeights()
          const numWeights = _weights?.shape[_weights?.shape.length - 1]
          const weights = _weights?.transpose().reshape([numWeights, -1])
          const maxAbsWeight = // needed only for dense connections
            l.getClassName() === "Dense" ? _weights?.abs().max() : undefined
          return { weights, biases, maxAbsWeight } as const
        })
      })

      try {
        const newStates = await Promise.all(
          _newStates.map(async (l) => ({
            weights: (await l.weights?.array()) as number[][] | undefined,
            biases: (await l.biases?.array()) as number[] | undefined,
            maxAbsWeight: (await l.maxAbsWeight?.array()) as number | undefined,
          }))
        )
        setWeightsBiases(newStates)
      } catch (e) {
        console.log("Error updating weights", e)
      } finally {
        _newStates.forEach((l) => {
          l.weights?.dispose()
          // l.biases?.dispose()
          l.maxAbsWeight?.dispose()
        })
      }
    }
    updateWeights()
  }, [model, batchCount])
  return weightsBiases
}
