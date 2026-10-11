import { getReceptiveFieldOrigin } from "@/model/layers/get-input-nids"
import { getIndex3d } from "./helpers"
import type { NeuronStateful } from "./types"

export const MAX_CONNECTIONS = 48
const NEUTRAL_STRENGTH = 0.5 // for connections that can't be ranked

export interface InputConnection {
  index: number // neuron index in the previous layer
  strength: number // between -1 and 1 (signed, relative to the strongest input)
}

// returns the strongest inputs of a neuron, sorted by descending strength
// ranked by weighted input (weight * activation), fallback: weight or activation only
// activations are often not available (WebGPU: only downloaded for the output layer, see getActivations)
export function getTopInputs(
  neuron: NeuronStateful,
  prevActivations?: Float32Array,
  k = MAX_CONNECTIONS,
): InputConnection[] {
  const { inputIdxs, weights } = neuron
  const getWeightIdx = getWeightIdxFunc(neuron)
  const hasWeights = !!weights && !!getWeightIdx
  if (!hasWeights && !prevActivations) {
    // nothing to rank by (e.g. pooling, normalization): show the inputs as they are
    return Array.from(inputIdxs.slice(0, k), (index) => ({ index, strength: NEUTRAL_STRENGTH }))
  }

  // sorted by descending abs score, max length k
  const topPos: number[] = [] // position in inputIdxs
  const topScores: number[] = []
  for (let i = 0; i < inputIdxs.length; i++) {
    const weight = hasWeights ? weights[getWeightIdx(i)] : 1
    const activation = prevActivations ? prevActivations[inputIdxs[i]] : 1
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

  // one-to-one connections are always shown
  if (!topPos.length && inputIdxs.length === 1) return [{ index: inputIdxs[0], strength: 0 }]

  const maxAbs = Math.abs(topScores[0])
  return topPos.map((pos, i) => ({
    index: inputIdxs[pos],
    strength: topScores[i] / maxAbs,
  }))
}

// weight * activation of the previous layer for every weight of a neuron, in the order of neuron.weights
// NaN: no input at this kernel position (outside of the previous layer, "same" padding)
export function getWeightedInputs(neuron: NeuronStateful, prevActivations: ArrayLike<number>) {
  const { inputIdxs, weights } = neuron
  const getWeightIdx = getWeightIdxFunc(neuron)
  if (!weights || !getWeightIdx) return undefined
  const weightedInputs = weights.map(() => NaN)
  for (let i = 0; i < inputIdxs.length; i++) {
    const weightIdx = getWeightIdx(i)
    weightedInputs[weightIdx] = weights[weightIdx] * prevActivations[inputIdxs[i]]
  }
  return weightedInputs
}

// weights that can be assigned to the neurons of the previous layer (Dense, Conv2D)
export const hasWeightedInputs = (neuron: NeuronStateful) => !!getWeightIdxFunc(neuron)

// maps the position in inputIdxs to the index in neuron.weights (as returned from getLayerWeights)
function getWeightIdxFunc(neuron: NeuronStateful) {
  const { layer, inputIdxs, weights } = neuron
  if (!weights?.length || !layer.prevLayer) return undefined
  if (layer.layerType === "Conv2D") {
    const [kernelHeight, kernelWidth] = layer.tfLayer.getConfig().kernelSize as number[]
    const prevTfLayer = layer.prevLayer.tfLayer
    const prevShape = prevTfLayer.outputShape as number[]
    const [top, left] = getReceptiveFieldOrigin(layer.tfLayer, neuron.index, prevTfLayer)
    return (i: number) => {
      // the position in the kernel is derived from the input: inputs outside of the previous layer are skipped
      const [y, x, c] = getIndex3d(inputIdxs[i], prevShape)
      return getConv2DWeightIdx(y - top, x - left, c, kernelHeight, kernelWidth)
    }
  }
  if (weights.length === inputIdxs.length) return (i: number) => i // Dense
  return undefined
}

// kernel position [y, x, c] to index in weights: ordered by [depth, width, height]
// (transposed kernel, see getLayerWeights)
export function getConv2DWeightIdx(
  y: number,
  x: number,
  c: number,
  kernelHeight: number,
  kernelWidth: number,
) {
  return (c * kernelWidth + x) * kernelHeight + y
}
