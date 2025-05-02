import { useEffect, useRef, useState } from "react"
import { getScene, useSceneStore } from "@/store"
import { getNeuronColor, getPredictionQualityColor } from "../utils/colors"
import type { LayerActivations, WeightsBiases } from "@/model"
import type { LayerStateful, LayerStateless, Neuron, Nid } from "./types"
import type { Sample } from "@/data"

// add activations and other state to each neuron

export function useStatefulLayers(
  statelessLayers: LayerStateless[],
  activations: LayerActivations[],
  weightsBiases: WeightsBiases[],
  sample?: Sample
) {
  const model = useSceneStore((s) => s.model)
  const isRegression = useSceneStore((s) => s.isRegression())
  const yMean = useSceneStore((s) => s.ds?.train.yMean)

  const statefulLayers = useSceneStore((s) => s.statefulLayers)
  const setStatefulLayers = useSceneStore((s) => s.setStatefulLayers)

  const focussedIdx = useDeferUnfocussed(sample)

  const setAllNeurons = useSceneStore((s) => s.setAllNeurons)

  useEffect(() => {
    async function update() {
      if (!model || !sample) return

      const hasFocussed = typeof focussedIdx === "number"
      const oldLayers = getScene().getState().statefulLayers
      const allNeurons = new Map<Nid, Neuron>()
      const newStatefulLayers = statelessLayers.reduce((acc, layer, lIdx) => {
        if (hasFocussed && focussedIdx !== layer.index && lIdx > 0) {
          // skip unfocussed layers: using the layer from previous state or stateless layer
          const dummy = oldLayers[lIdx] ?? layer
          return [...acc, dummy as LayerStateful]
        }

        const layerActivations = activations?.[lIdx]?.activations
        const normalizedActivations =
          layer.layerPos === "output"
            ? layerActivations
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
              isRegression && layer.layerPos === "output"
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

      setAllNeurons(allNeurons)
      setStatefulLayers(newStatefulLayers)
    }

    update()
  }, [
    model,
    statelessLayers,
    activations,
    weightsBiases,
    sample,
    isRegression,
    yMean,
    focussedIdx,
    setStatefulLayers,
    setAllNeurons,
  ])

  return statefulLayers
}

function useDeferUnfocussed(sample?: Sample, ms = 500) {
  // browse samples faster in single layer view (flat view) by deferring the update for unfocussed layers
  const focussedIdx = useSceneStore((s) => s.focussedLayerIdx)
  const [allowOthers, setAllowOthers] = useState(false)
  const isFlatView = useSceneStore((s) => s.vis.flatView)
  const timeoutUnset = useRef<NodeJS.Timeout | null>(null)
  const lastSample = useRef<Sample | undefined>(sample)
  useEffect(() => {
    lastSample.current = sample
    if (timeoutUnset.current) clearTimeout(timeoutUnset.current)
    timeoutUnset.current = setTimeout(() => setAllowOthers(true), ms)
    return () => setAllowOthers(false)
  }, [sample, ms])
  const isNewSample = lastSample.current !== sample
  return isFlatView && (isNewSample || !allowOthers) ? focussedIdx : undefined
}

export function updateGroups(statefulLayer: LayerStateful) {
  const groupedNeurons = groupNeuronsByGroupIndex(statefulLayer)
  statefulLayer.groups = statefulLayer.groups.map((group) => ({
    ...group,
    neurons: groupedNeurons[group.index],
  }))
  statefulLayer.layerGroup = {
    ...statefulLayer.layerGroup,
    neurons: [...statefulLayer.neurons],
  }
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
