import * as tf from "@tensorflow/tfjs"
import { useSceneStore } from "@/store"
import { useEffect } from "react"
import { getLayerActivations } from "./activations"
import { getDbDataAsTensors } from "@/data/dataset"

// store min and max activations for each neuron across all samples for per-neuron normalization in regression tasks

export interface ActivationStats {
  mean: Float32Array
  std: Float32Array
} // arrays with values for each neuron in the layer

export function useActivationStats() {
  const model = useSceneStore((s) => s.model)
  const ds = useSceneStore((s) => s.ds)
  const activationStats = useSceneStore((s) => s.activationStats)
  const setActivationStats = useSceneStore((s) => s.setActivationStats)
  const isTraining = useSceneStore((s) => s.isTraining) // update after training
  useEffect(() => {
    async function getActivationStats() {
      if (!model || !ds || isTraining) return
      if (ds.task !== "regression") return
      const data = await getDbDataAsTensors(ds, "train")
      if (!data) return
      const { X } = data
      const statsTensors = tf.tidy(
        () =>
          getLayerActivations(model, X)?.map((la) => {
            // const min = la.min(0)
            // const max = la.max(0)
            const { mean, variance } = tf.moments(la, 0)
            const std = variance.sqrt().add(1e-7)
            return { mean, std }
          }) ?? []
      )
      try {
        const newActivationStats: { [layerIdx: number]: ActivationStats } = {}
        for (const [i, t] of statsTensors.entries()) {
          const mean = (await t.mean.data()) as Float32Array
          const std = (await t.std.data()) as Float32Array
          newActivationStats[i] = { mean, std }
        }
        setActivationStats(newActivationStats)
      } catch {
        console.log("error")
      } finally {
        Object.values(data).forEach((t) => t?.dispose())
        statsTensors.forEach((t) =>
          Object.values(t).forEach((v) => v.dispose())
        )
      }
    }
    getActivationStats()
  }, [model, ds, isTraining, setActivationStats])

  return activationStats
}
