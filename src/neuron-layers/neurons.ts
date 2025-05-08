import { useMemo } from "react"
import { getLayers, useSceneStore } from "@/store"
import { getLayerDef } from "@/model/layers"
import { getLayerWeights } from "@/model/weights"
import type { Index3D, Neuron, NeuronStateful, Nid } from "./types"
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

export function createNeuron(nid?: Nid, withInputs = true): Neuron | undefined {
  if (!nid) return undefined
  const { layerIdx, neuronIdx } = parseNid(nid)
  const layer = getLayers().find((l) => l.index === layerIdx)
  if (!layer) return undefined
  const { hasColorChannels, tfLayer } = layer
  const numChannels = (tfLayer.outputShape?.[3] as number | undefined) ?? 1
  const channelIdx = neuronIdx % numChannels
  const layerDef = getLayerDef(layer.layerType)
  const prevLayer = layer.prevLayer
  const inputNids =
    prevLayer && withInputs
      ? layerDef?.getInputNids?.(
          layer.tfLayer,
          neuronIdx,
          prevLayer.tfLayer,
          prevLayer.index
        ) ?? []
      : []
  const neuron: Neuron = {
    index: neuronIdx,
    nid,
    layer,
    index3d: getIndex3d(neuronIdx, tfLayer.outputShape as number[]),
    channelIdx,
    indexInChannel: Math.floor(neuronIdx / numChannels),
    meshRef: hasColorChannels ? layer.meshRefs[channelIdx] : layer.meshRefs[0],
    inputNids,
    inputNeurons: inputNids
      .map((nid) => createNeuron(nid, false))
      .filter(Boolean) as Neuron[],
  }
  return neuron
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
  const weights = _weights?.[filterIdx]
  const bias = biases?.[filterIdx]
  const statefulNeuron: NeuronStateful = {
    ...neuron,
    activation: layerActivations?.activations[nIdx],
    weights,
    bias,
    rawInput: neuron.layer.layerPos === "input" ? rawX?.[nIdx] : undefined,
  }
  return statefulNeuron
}

export function getNid(layerIdx: number, neuronIdx: number) {
  return `${layerIdx}_${neuronIdx}` as Nid
}

export function parseNid(nid: Nid): {
  layerIdx: number
  neuronIdx: number
} {
  const [layerIdx, neuronIdx] = nid.split("_").map(Number)
  if (isNaN(layerIdx) || isNaN(neuronIdx)) {
    throw new Error(`Invalid nid: ${nid}`)
  }
  return { layerIdx, neuronIdx }
}

export function getIndex3d(flatIndex: number, outputShape: number[]) {
  const [, , width = 1, depth = 1] = outputShape
  const depthIndex = flatIndex % depth
  const widthIndex = Math.floor(flatIndex / depth) % width
  const heightIndex = Math.floor(flatIndex / (depth * width))
  return [heightIndex, widthIndex, depthIndex] as Index3D
}

export function getFlatIndex(
  heightIndex: number,
  widthIndex: number,
  depthIndex: number,
  outputShape: number[]
): number {
  const [, , width = 1, depth = 1] = outputShape
  return (heightIndex * width + widthIndex) * depth + depthIndex
}
