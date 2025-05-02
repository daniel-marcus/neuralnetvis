import { useStatelessLayers } from "./layers-stateless"
import { useActivationStats } from "@/model/activation-stats"
import { useSceneStore } from "@/store"
import { useActivations } from "@/model/activations"

export function useLayers() {
  const ds = useSceneStore((s) => s.ds)
  const model = useSceneStore((s) => s.model)
  const sample = useSceneStore((s) => s.sample)

  const layers = useStatelessLayers(model, ds)
  const activationStats = useActivationStats(model, ds)
  useActivations(sample, activationStats)
  return layers
}
