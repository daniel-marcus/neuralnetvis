import { useMemo } from "react"
import { getLayers, useSceneStore } from "@/store"
import { getLayerDef } from "@/model/layers"
import { getNeuronWeights } from "@/model/weights"
import { getFullyConnectedInputNids } from "@/model/layers/get-input-nids"
import { getIndex3d, getUnits } from "./helpers"
import type { Neuron, NeuronStateful, Nid } from "./types"
import type { LayerActivations } from "@/model"
import type { Sample } from "@/data"

export function useHovered() {
  const hoveredNid = useSceneStore((s) => s.hoveredNid)
  return useNeuron(hoveredNid)
}

export function useSelected() {
  const selectedNid = useSceneStore((s) => s.selectedNid)
  return useNeuron(selectedNid)
}

function useNeuron(nid?: Nid) {
  const activations = useSceneStore((s) => s.activations)
  const rawX = useSceneStore((s) => s.sample?.rawX)
  // TODO: use Effect and save in store for reusability?
  const neuron = useMemo(() => createNeuron(nid), [nid])
  return useMemo(() => {
    if (!neuron) return undefined
    const layerActivations = activations?.[neuron.layer.index]
    const statefulNeuron = makeStateful(neuron, layerActivations, rawX)
    return statefulNeuron
  }, [neuron, activations, rawX])
}

function createNeuron(nid?: Nid): Neuron | undefined {
  if (!nid) return undefined
  const { layerIdx, neuronIdx } = parseNid(nid)
  const layer = getLayers().find((l) => l.index === layerIdx)
  if (!layer) return undefined
  const { hasColorChannels, outputShape } = layer
  const numChannels = outputShape[3] ?? 1
  const channelIdx = neuronIdx % numChannels
  const layerDef = getLayerDef(layer.layerType)
  const getInputNids = layerDef?.getInputNids
  const inputs = !getInputNids
    ? []
    : layer.inputLayers.map((inputLayer) => ({
        layer: inputLayer,
        idxs:
          getInputNids === getFullyConnectedInputNids
            ? Uint32Array.from({ length: getUnits(inputLayer.tfLayer) }, (_, i) => i) // all neurons (without creating nids)
            : Uint32Array.from(
                getInputNids(layer.tfLayer, neuronIdx, inputLayer.tfLayer, inputLayer.index),
                (inputNid) => parseNid(inputNid).neuronIdx,
              ),
      }))
  const neuron: Neuron = {
    index: neuronIdx,
    nid,
    layer,
    index3d: getIndex3d(neuronIdx, outputShape),
    channelIdx,
    indexInChannel: Math.floor(neuronIdx / numChannels),
    meshRef: hasColorChannels ? layer.meshRefs[channelIdx] : layer.meshRefs[0],
    inputs,
    inputIdxs: inputs[0]?.idxs ?? new Uint32Array(),
  }
  return neuron
}

// add state to neuron: activations, weights, biases
function makeStateful(
  neuron: Neuron,
  layerActivations?: LayerActivations,
  rawX?: Sample["rawX"],
): NeuronStateful {
  const nIdx = neuron.index
  const filterIdx = nIdx % neuron.layer.numBiases // for dense layers this would be nIdx
  const { weights, bias } = getNeuronWeights(neuron.layer.tfLayer, filterIdx)
  const statefulNeuron: NeuronStateful = {
    ...neuron,
    activation: layerActivations?.activations?.[nIdx],
    weights,
    bias,
    rawInput: neuron.layer.layerPos === "input" ? rawX?.[nIdx] : undefined,
  }
  return statefulNeuron
}

function parseNid(nid: Nid): {
  layerIdx: number
  neuronIdx: number
} {
  const [layerIdx, neuronIdx] = nid.split("_").map(Number)
  if (isNaN(layerIdx) || isNaN(neuronIdx)) {
    throw new Error(`Invalid nid: ${nid}`)
  }
  return { layerIdx, neuronIdx }
}
