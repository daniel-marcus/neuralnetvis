import type { NeuronLayer, NeuronStateful } from "./types"

export const MAX_CONNECTIONS = 48

export interface InputConnection {
  index: number // neuron index in the previous layer
  strength: number // between -1 and 1 (signed, relative to the strongest input)
}

// returns the strongest inputs of a neuron, sorted by descending strength
// ranked by weighted input (weight * activation), fallback: weight or activation only
export function getTopInputs(
  neuron: NeuronStateful,
  prevActivations?: Float32Array,
  k = MAX_CONNECTIONS,
): InputConnection[] {
  const { inputNids, weights, layer } = neuron
  const getWeightIdx = getWeightIdxFunc(layer, inputNids.length, weights?.length)
  const hasWeights = !!weights && !!getWeightIdx

  // sorted by descending abs score, max length k
  const topPos: number[] = [] // position in inputNids
  const topScores: number[] = []
  for (let i = 0; i < inputNids.length; i++) {
    const weight = hasWeights ? weights[getWeightIdx(i)] : 1
    const activation = prevActivations ? prevActivations[parseNeuronIdx(inputNids[i])] : 1
    if (!hasWeights && !prevActivations) break // nothing to rank by
    const score = weight * activation
    const absScore = Math.abs(score)
    if (!absScore) continue // incl. NaN
    if (topPos.length === k && absScore <= Math.abs(topScores[k - 1])) continue
    let j = topPos.length
    while (j > 0 && Math.abs(topScores[j - 1]) < absScore) j--
    topPos.splice(j, 0, i)
    topScores.splice(j, 0, score)
    if (topPos.length > k) {
      topPos.pop()
      topScores.pop()
    }
  }

  const maxAbs = Math.abs(topScores[0])
  return topPos.map((pos, i) => ({
    index: parseNeuronIdx(inputNids[pos]),
    strength: topScores[i] / maxAbs,
  }))
}

// maps the position in inputNids to the index in neuron.weights (as returned from getLayerWeights)
function getWeightIdxFunc(layer: NeuronLayer, numInputs: number, numWeights?: number) {
  if (!numWeights || !layer.prevLayer) return undefined
  if (layer.layerType === "Conv2D") {
    const [kernelHeight, kernelWidth] = layer.tfLayer.getConfig().kernelSize as number[]
    const depth = (layer.prevLayer.tfLayer.outputShape as number[])[3]
    return (i: number) => getConv2DWeightIdx(i, kernelHeight, kernelWidth, depth)
  }
  if (numWeights === numInputs) return (i: number) => i // Dense
  return undefined
}

// inputNids (see getReceptiveFieldInputNids) are ordered by [height, width, depth],
// weights by [depth, width, height] (transposed kernel, see getLayerWeights)
export function getConv2DWeightIdx(
  i: number,
  kernelHeight: number,
  kernelWidth: number,
  depth: number,
) {
  const c = i % depth
  const x = Math.floor(i / depth) % kernelWidth
  const y = Math.floor(i / (depth * kernelWidth))
  return (c * kernelWidth + x) * kernelHeight + y
}

function parseNeuronIdx(nid: string) {
  return Number(nid.slice(nid.indexOf("_") + 1))
}
