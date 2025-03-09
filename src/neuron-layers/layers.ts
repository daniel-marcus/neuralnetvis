import { useStatelessLayers } from "./layers-stateless"
import { useActivations } from "@/model/activations"
import { useWeights } from "@/model/weights"
import { useStatefulLayers } from "./layers-stateful"
import { useNeuronSelect } from "./neuron-select"
import { useSceneStore } from "@/store"
import { useDsDef } from "@/data/dataset"

export function useLayers(isPreview?: boolean, dsKey?: string) {
  const dsDef = useDsDef(dsKey)
  const model = useSceneStore((s) => s.model)
  const sample = useSceneStore((s) => s.sample)

  const _lyrs = useStatelessLayers(model, dsDef) // dsDef
  const activations = useActivations(model, sample?.X)
  const weights = useWeights(model)
  const _layers = useStatefulLayers(_lyrs, activations, weights, sample?.rawX)
  const layers = useNeuronSelect(!isPreview, _layers)
  return layers
}
