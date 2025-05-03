import { getIndex3d, getNid, getUnits } from "@/neuron-layers/layers-stateless"
import type { GetInputNidsFunc } from "./types"
import type { Index3D, Nid } from "@/neuron-layers"

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
  const shape = prevLayer.outputShape as number[]
  const prevUnits = getUnits(prevLayer)
  return Array.from({ length: prevUnits }).map((_, i) => {
    const index3d = getIndex3d(i, shape)
    return getNid(prevLayerIdx, index3d)
  })
}

// for BatchNormalization etc:
// each neuron is connected to 1 neuron in the previous layer
export const getOneToOneInputNids: GetInputNidsFunc = (
  _,
  nIdx,
  prevLayer,
  prevLayerIdx
) => {
  const shape = prevLayer.outputShape as number[]
  const index3d = getIndex3d(nIdx, shape)
  return [getNid(prevLayerIdx, index3d)]
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
  const prevOutputShape = prevLayer.outputShape as number[]
  const depth = prevOutputShape[3]

  const inputNids: Nid[] = []
  for (let k = 0; k < filterSize * depth; k++) {
    const [thisY, thisX, thisDepth] = getIndex3d(nIdx, outputShape)
    const depthIndex = k % depth
    if (depthwise && depthIndex !== thisDepth) continue
    const widthIndex =
      thisX * strideWidth + (Math.floor(k / depth) % filterWidth)
    const heightIndex =
      thisY * strideHeight + Math.floor(k / (depth * filterWidth))
    const index3d = [heightIndex, widthIndex, depthIndex] as Index3D
    const inputNid = getNid(prevLayerIdx, index3d)
    inputNids.push(inputNid)
  }

  return inputNids
}
