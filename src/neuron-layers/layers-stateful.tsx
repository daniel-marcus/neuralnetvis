import { useMemo } from "react"
import { getNeuronColor } from "./colors"
import type { LayerActivations, WeightsBiases } from "@/model"
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
          prevLayer: acc.find((l) => l.visibleIdx === layer.visibleIdx - 1),
          neurons,
          maxAbsWeight,
        } as LayerStateful

        const groupedNeurons = groupNeuronsByGroupIndex(statefulLayer)
        statefulLayer.groups = statefulLayer.groups.map((group) => ({
          ...group,
          neurons: groupedNeurons[group.index],
        }))
        return [...acc, statefulLayer]
      }, [] as LayerStateful[]),
    [statelessLayers, activations, weightsBiases, rawInputs]
  )
  return statefulLayers
}

function groupNeuronsByGroupIndex(layer: LayerStateful) {
  const neuronsByGroup = {} as { [key: number]: Neuron[] }
  for (let i = 0; i < layer.groups.length; i++) {
    neuronsByGroup[i] = []
  }
  for (const neuron of layer.neurons) {
    neuronsByGroup[neuron.groupIndex].push(neuron)
  }
  return neuronsByGroup
}
