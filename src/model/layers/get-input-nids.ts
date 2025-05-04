import { getUnits } from "@/neuron-layers/layers"
import { getFlatIndex, getIndex3d, getNid } from "@/neuron-layers/neurons"
import type { GetInputNidsFunc } from "./types"
import type { Nid } from "@/neuron-layers"

// reusable getInputNids functions

// for Dense etc
// each neuron is connected to all neurons in the previous layer
export const getFullyConnectedInputNids: GetInputNidsFunc = (
  _,
  __,
  prevLayer,
  prevLayerIdx
) => {
  // each neuron is connected to all neurons in the previous layer
  const prevUnits = getUnits(prevLayer)
  return Array.from({ length: prevUnits }).map((_, i) => {
    return getNid(prevLayerIdx, i)
  })
}

// for BatchNormalization etc:
// each neuron is connected to 1 neuron in the previous layer
export const getOneToOneInputNids: GetInputNidsFunc = (
  _,
  nIdx,
  __,
  prevLayerIdx
) => {
  return [getNid(prevLayerIdx, nIdx)]
}

// for Conv2D, DepthwiseConv2D, MaxPooling2D etc
// each neuron is connected to a receptive field of neurons in the previous layer
export const getReceptiveFieldInputNids: GetInputNidsFunc = (
  l,
  nIdx,
  prevLayer,
  prevLayerIdx,
  depthwise?: boolean // for DepthwiseConv2D and MaxPooling2D
) => {
  // get the receptive field
  const [filterHeight, filterWidth] =
    (l.getConfig().kernelSize as number[]) ??
    (l.getConfig().poolSize as number[]) ??
    ([] as number[])
  const [strideHeight, strideWidth] = (l.getConfig().strides as number[]) ?? [
    1, 1,
  ]
  const filterSize = filterHeight * filterWidth

  const outputShape = l.outputShape as number[]
  const prevShape = prevLayer.outputShape as number[]
  const depth = prevShape[3]

  const inputNids: Nid[] = []
  for (let k = 0; k < filterSize * depth; k++) {
    const [thisY, thisX, thisDepth] = getIndex3d(nIdx, outputShape)
    const depthIdx = k % depth
    if (depthwise && depthIdx !== thisDepth) continue
    const widthIdx = thisX * strideWidth + (Math.floor(k / depth) % filterWidth)
    const heightIdx =
      thisY * strideHeight + Math.floor(k / (depth * filterWidth))
    const flatIndex = getFlatIndex(heightIdx, widthIdx, depthIdx, prevShape)
    const inputNid = getNid(prevLayerIdx, flatIndex)
    inputNids.push(inputNid)
  }

  return inputNids
}
