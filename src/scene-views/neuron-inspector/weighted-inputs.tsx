import { useEffect, useMemo, useState } from "react"
import * as tf from "@tensorflow/tfjs"
import { useSceneStore } from "@/store"
import { getLayerInput } from "@/model/feature-vis"
import { getLayerActivationsAsync } from "@/model/get-layer-activations"
import { getWeightedInputs } from "@/neuron-layers/connections"
import { normalizeWithSign } from "@/data/utils"
import { ViewerSlot } from "./viewer-slot"
import { WeightsGrid } from "./weights-viewer"
import type { NeuronStateful } from "@/neuron-layers/types"

type LayerInput = { tfLayer: tf.layers.Layer; values: tf.TypedArray }

// the input of a layer for the current sample = raw activations of the previous layer
// downloaded on demand: the store has them for the output layer only (see getActivations)
function useLayerInput(tfLayer: tf.layers.Layer) {
  const model = useSceneStore((s) => s.model)
  const sample = useSceneStore((s) => s.sample)
  const isTraining = useSceneStore((s) => s.isTraining)
  const [current, setCurrent] = useState<LayerInput>()
  useEffect(() => {
    if (!model || !sample || isTraining) return // weights are changing
    let aborted = false
    const { xTensor } = sample
    async function load() {
      const outputs = [getLayerInput(tfLayer)]
      const tensors = await getLayerActivationsAsync(model!, xTensor, outputs, {
        shouldAbort: () => aborted,
      })
      if (!tensors) return
      try {
        const values = await tensors[0].data()
        if (!aborted) setCurrent({ tfLayer, values })
      } finally {
        tf.dispose(tensors)
      }
    }
    load().catch((e) => console.error("Error getting layer input", e))
    return () => {
      aborted = true
    }
  }, [model, tfLayer, sample, isTraining])
  // the previous sample is kept until the new one is loaded (no flicker)
  return current?.tfLayer === tfLayer ? current.values : undefined
}

// weight * input for the current sample: what each input contributes to the neuron's activation
export const WeightedInputsViewer = ({ neuron }: { neuron: NeuronStateful }) => {
  const { tfLayer, prevLayer } = neuron.layer
  const input = useLayerInput(tfLayer)
  const weightedInputs = useMemo(() => {
    if (!input || input.length !== prevLayer?.numNeurons) return undefined
    return normalizeWithSign(getWeightedInputs(neuron, input))
  }, [neuron, input, prevLayer])
  if (!weightedInputs) return <ViewerSlot>{null}</ViewerSlot>
  return <WeightsGrid neuron={neuron} weights={weightedInputs} />
}
