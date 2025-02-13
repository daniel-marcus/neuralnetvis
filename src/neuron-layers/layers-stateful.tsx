import { useMemo } from "react"
import type { LayerActivations } from "@/model/activations"
import type { WeightsBiases } from "@/model/weights"
import { getNeuronColor } from "./colors"
import type { LayerStateful, LayerStateless, Neuron } from "./types"

// add state to each neuron

export function useStatefulLayers(
  statelessLayers: LayerStateless[],
  activations: LayerActivations[],
  weightsBiases: WeightsBiases[],
  rawInputs?: number[]
) {
  const statefulLayers = useMemo(
    () =>
      statelessLayers.reduce((acc, layer, lIdx) => {
        const { layerPos, layerType } = layer

        const layerActivations = activations?.[lIdx]?.activations
        const normalizedActivations =
          layerPos === "output"
            ? layerActivations
            : layerType === "Flatten"
            ? undefined
            : activations?.[lIdx]?.normalizedActivations

        const { weights, biases, maxAbsWeight } = weightsBiases[lIdx] ?? {}

        const neurons: Neuron[] = statelessLayers[lIdx].neurons.map(
          (neuron, nIdx) => {
            const activation = layerActivations?.[nIdx]
            // Conv2D has parameter sharing: 1 bias per filter + [filterSize] weights
            const filterIndex = nIdx % layer.numBiases // for dense layers this would be nIdx
            const rawInput =
              layer.layerPos === "input" ? rawInputs?.[nIdx] : undefined
            const n = {
              ...neuron,
              activation,
              rawInput,
              normalizedActivation: normalizedActivations?.[nIdx],
              weights: weights?.[filterIndex],
              bias: biases?.[filterIndex],
            } as Neuron
            n.color = getNeuronColor(n)
            return n
          }
        )
        const statefulLayer = {
          ...layer,
          neurons,
          maxAbsWeight,
        }
        return [...acc, statefulLayer]
      }, [] as LayerStateful[]),
    [statelessLayers, activations, weightsBiases, rawInputs]
  )
  return statefulLayers
}
