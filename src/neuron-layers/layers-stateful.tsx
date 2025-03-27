import { useEffect, useMemo } from "react"
import { useSceneStore } from "@/store"
import { getNeuronColor, getPredictionQualityColor } from "../utils/colors"
import type { LayerActivations, WeightsBiases } from "@/model"
import type { LayerStateful, LayerStateless, Neuron, Nid } from "./types"
import type { Sample } from "@/data"

// add state to each neuron

export function useStatefulLayers(
  statelessLayers: LayerStateless[],
  activations: LayerActivations[],
  weightsBiases: WeightsBiases[],
  sample?: Sample
) {
  const isRegression = useSceneStore((s) => s.isRegression())
  const yMean = useSceneStore((s) => s.ds?.train.yMean)
  const [statefulLayers, allNeurons] = useMemo(() => {
    const allNeurons = new Map<Nid, Neuron>()
    const result = statelessLayers.reduce((acc, layer, lIdx) => {
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
            layer.layerPos === "input" ? sample?.rawX?.[nIdx] : undefined

          const newNeuron = {
            ...neuron,
            activation,
            rawInput,
            normalizedActivation: normalizedActivations?.[nIdx],
            weights: weights?.[filterIndex],
            bias: biases?.[filterIndex],
          } as Neuron
          newNeuron.color =
            isRegression && layerPos === "output"
              ? getPredictionQualityColor(newNeuron, sample?.y, yMean)
              : getNeuronColor(newNeuron)

          allNeurons.set(newNeuron.nid, newNeuron)

          return newNeuron
        }
      )

      const _statefulLayer = {
        ...layer,
        prevLayer: acc.find((l) => l.visibleIdx === layer.visibleIdx - 1),
        neurons,
        maxAbsWeight,
      } as LayerStateful

      const statefulLayer = updateGroups(_statefulLayer)
      return [...acc, statefulLayer]
    }, [] as LayerStateful[])

    return [result, allNeurons] as const
  }, [statelessLayers, activations, weightsBiases, sample, isRegression, yMean])

  const setAllNeurons = useSceneStore((s) => s.setAllNeurons)
  useEffect(() => {
    setAllNeurons(allNeurons)
  }, [allNeurons, setAllNeurons])

  return statefulLayers
}

export function updateGroups(statefulLayer: LayerStateful) {
  const groupedNeurons = groupNeuronsByGroupIndex(statefulLayer)
  statefulLayer.groups = statefulLayer.groups.map((group) => ({
    ...group,
    neurons: groupedNeurons[group.index],
  }))
  return statefulLayer
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
