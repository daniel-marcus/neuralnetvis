import { useDatasetStore } from "@/data/data"
import { useModelStore } from "@/model/model"
import { useStatelessLayers } from "./layers-stateless"
import { useActivations } from "@/model/activations"
import { useWeights } from "@/model/weights"
import { useStatefulLayers } from "./layers-stateful"
import { useNeuronSelect } from "./neuron-select"

export function useLayers() {
  const { ds, input, rawInput } = useDatasetStore()
  const model = useModelStore((s) => s.model)
  const [__layers, neuronRefs] = useStatelessLayers(model, ds)
  const activations = useActivations(model, input)
  const weights = useWeights(model)
  const _layers = useStatefulLayers(__layers, activations, weights, rawInput)
  const layers = useNeuronSelect(_layers)
  return [layers, neuronRefs] as const
}
