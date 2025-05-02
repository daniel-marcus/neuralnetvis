import { useStatelessLayers } from "./layers-stateless"
import { useActivationStats } from "@/model/activation-stats"
import { useWeights } from "@/model/weights"
// import { useStatefulLayers } from "./layers-stateful"
// import { useNeuronSelect } from "./neuron-select"
import { useSceneStore } from "@/store"
import { useActivations } from "@/model/activations"
import { LayerStateful } from "./types"

export function useLayers() {
  // isPreview?: boolean
  const ds = useSceneStore((s) => s.ds)
  const model = useSceneStore((s) => s.model)
  const sample = useSceneStore((s) => s.sample)

  const _lyrs = useStatelessLayers(model, ds)
  const activationStats = useActivationStats(model, ds)
  useActivations(sample, activationStats)
  useWeights(model)
  // const _layers = useStatefulLayers(_lyrs, activations, weights, sample)
  // const layers = useNeuronSelect(!isPreview, _layers)
  return _lyrs as LayerStateful[] // layers
}
