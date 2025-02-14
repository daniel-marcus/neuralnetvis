import { useStatelessLayers } from "./layers-stateless"
import { useActivations } from "@/model/activations"
import { useWeights } from "@/model/weights"
import { useStatefulLayers } from "./layers-stateful"
import { useNeuronSelect } from "./neuron-select"
import { useStore } from "@/store"

export function useLayers() {
  const ds = useStore((s) => s.ds)
  const sample = useStore((s) => s.sample)
  const model = useStore((s) => s.model)
  const _lyrs = useStatelessLayers(model, ds)
  const activations = useActivations(model, sample?.X)
  const weights = useWeights(model)
  const _layers = useStatefulLayers(_lyrs, activations, weights, sample?.rawX)
  const layers = useNeuronSelect(_layers)
  return layers
}
