import { useDatasetStore } from "@/data/dataset"
import { useModelStore } from "@/model/model"
import { useStatelessLayers } from "./layers-stateless"
import { useActivations } from "@/model/activations"
import { useWeights } from "@/model/weights"
import { useStatefulLayers } from "./layers-stateful"
import { useNeuronSelect } from "./neuron-select"

export function useLayers() {
  const { ds, sample } = useDatasetStore()
  const model = useModelStore((s) => s.model)
  const _lyrs = useStatelessLayers(model, ds)
  const activations = useActivations(model, sample?.X)
  const weights = useWeights(model)
  const _layers = useStatefulLayers(_lyrs, activations, weights, sample?.rawX)
  const layers = useNeuronSelect(_layers)
  return layers
}
