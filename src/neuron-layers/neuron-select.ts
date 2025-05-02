import { useMemo } from "react"
import { useSceneStore } from "@/store"
import { getLayerWeights } from "@/model/weights"
import type { NeuronStateful, Nid } from "./types"

export function useHovered() {
  const hoveredNid = useSceneStore((s) => s.hoveredNid)
  return useNeuron(hoveredNid)
}

export function useSelected() {
  const selectedNid = useSceneStore((s) => s.selectedNid)
  return useNeuron(selectedNid)
}

function useNeuron(nid?: Nid) {
  const allNeurons = useSceneStore((s) => s.allNeurons)
  const activations = useSceneStore((s) => s.activations)
  const rawX = useSceneStore((s) => s.sample?.rawX)
  return useMemo(() => {
    if (!nid) return undefined
    const neuron = allNeurons.get(nid)
    if (!neuron) return undefined

    // TODO: add some state here: weights, biases, etc.
    const nIdx = neuron.index
    const layerActivations = activations[neuron.layer.index]
    const { weights, biases } = getLayerWeights(neuron.layer.tfLayer)
    const filterIdx = nIdx % neuron.layer.numBiases // for dense layers this would be nIdx
    //const layerDef = getLayerDef(neuron.layer.layerType)
    // const prevLayer = neuron.layer.prevLayer
    const statefulNeuron: NeuronStateful = {
      ...neuron,
      activation: layerActivations?.activations[nIdx],
      normalizedActivation: layerActivations?.normalizedActivations[nIdx],
      weights: weights?.[filterIdx],
      bias: biases?.[filterIdx],
      rawInput: neuron.layer.layerPos === "input" ? rawX?.[nIdx] : undefined,
      /* inputNeurons: prevLayer
        ? layerDef?.getInputNids?.(
            neuron.layer.tfLayer,
            prevLayer.tfLayer,
            prevLayer.index
          )[nIdx] // ??
        : [], */
    }

    return statefulNeuron
  }, [allNeurons, nid, activations, rawX])
}
