import * as tf from "@tensorflow/tfjs"
import { useSceneStore } from "@/store"
import { useEffect } from "react"
import { getLayerActivations } from "./activations"
import { getDbDataAsTensors } from "@/data/dataset"
import { Dataset } from "@/data"

// store min and max activations for each neuron across all samples for per-neuron normalization in regression tasks

export interface ActivationStats {
  min: tf.Tensor
  max: tf.Tensor
  mean: tf.Tensor
  std: tf.Tensor
} // tensors have values for each neuron in the layer

export function useActivationStats(model?: tf.LayersModel, ds?: Dataset) {
  const activationStats = useSceneStore((s) => s.activationStats)
  const setActivationStats = useSceneStore((s) => s.setActivationStats)
  const isTraining = useSceneStore((s) => s.isTraining) // update after training
  useEffect(() => {
    async function getActivationStats() {
      if (!model || !ds || isTraining) return
      if (ds.task !== "regression") return
      const data = await getDbDataAsTensors(ds, "train")
      if (!data) return
      const [X] = data
      const statsTensors = tf.tidy(() =>
        getLayerActivations(model, X).map((la) => {
          const min = la.min(0)
          const max = la.max(0)
          const { mean, variance } = tf.moments(la, 0)
          const std = variance.sqrt().add(1e-7)
          return { min, max, mean, std }
        })
      )
      try {
        setActivationStats(statsTensors)
        /* statsTensors.forEach((t) =>
          Object.entries(t).forEach(([key, v]) =>
            console.log(key, v.arraySync())
          )
        ) */
      } catch {
        console.log("error")
      } finally {
        data.forEach((t) => t.dispose())
      }
    }
    getActivationStats()
  }, [model, ds, isTraining, setActivationStats])

  useEffect(() => {
    return () => {
      if (activationStats?.length) {
        activationStats.map((layer) =>
          Object.values(layer).forEach((t) => t.dispose())
        )
      }
    }
  }, [activationStats])

  return activationStats
}
