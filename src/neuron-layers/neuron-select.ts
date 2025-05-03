import { useMemo } from "react"
import { useSceneStore } from "@/store"
import { getLayerDef } from "@/model/layers"
import { getLayerWeights } from "@/model/weights"
import type { Neuron, NeuronStateful, Nid } from "./types"
import type { LayerActivations } from "@/model"

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
  // TODO: use Effect and save in store for reusability
  return useMemo(() => {
    const neuron = nid ? allNeurons.get(nid) : undefined
    if (!neuron) return undefined
    const layerActivations = activations?.[neuron.layer.index]
    return makeStateful(neuron, layerActivations, rawX)
  }, [allNeurons, nid, activations, rawX])
}

// add state to neuron: activations, weights, biases, inputNeurons
function makeStateful(
  neuron: Neuron,
  layerActivations?: LayerActivations,
  rawX?: number[]
): NeuronStateful {
  const nIdx = neuron.index
  const filterIdx = nIdx % neuron.layer.numBiases // for dense layers this would be nIdx
  const { weights: _weights, biases } = getLayerWeights(neuron.layer.tfLayer)
  const weights = _weights?.[nIdx]
  const bias = biases?.[filterIdx]
  const layerDef = getLayerDef(neuron.layer.layerType)
  const prevLayer = neuron.layer.prevLayer
  const inputNids = prevLayer
    ? layerDef?.getInputNids?.(
        neuron.layer.tfLayer,
        nIdx,
        prevLayer.tfLayer,
        prevLayer.index
      ) ?? []
    : []
  const statefulNeuron: NeuronStateful = {
    ...neuron,
    activation: layerActivations?.activations[nIdx],
    normalizedActivation: layerActivations?.normalizedActivations[nIdx],
    weights,
    bias,
    rawInput: neuron.layer.layerPos === "input" ? rawX?.[nIdx] : undefined,
    inputNids,
    inputNeurons: inputNids
      .map((nid) => prevLayer?.neuronsMap?.get(nid))
      .filter(Boolean) as Neuron[],
  }
  return statefulNeuron
}
