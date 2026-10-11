import { getFlatIndex, getIndex3d, getNid, getUnits } from "@/neuron-layers/helpers"
import type { GetInputNidsFunc } from "./types"
import type { Nid } from "@/neuron-layers"
import type { Layer } from "@tensorflow/tfjs-layers/dist/exports_layers"

// reusable getInputNids functions

// for Dense etc
// each neuron is connected to all neurons in the previous layer
export const getFullyConnectedInputNids: GetInputNidsFunc = (_, __, prevLayer, prevLayerIdx) => {
  // each neuron is connected to all neurons in the previous layer
  const prevUnits = getUnits(prevLayer)
  return Array.from({ length: prevUnits }).map((___, i) => {
    return getNid(prevLayerIdx, i)
  })
}

// for BatchNormalization etc:
// each neuron is connected to 1 neuron in the previous layer
export const getOneToOneInputNids: GetInputNidsFunc = (_, nIdx, __, prevLayerIdx) => {
  return [getNid(prevLayerIdx, nIdx)]
}

// for Conv2D, DepthwiseConv2D, MaxPooling2D etc
// each neuron is connected to a receptive field of neurons in the previous layer
// inputs outside of the previous layer ("same" padding) are skipped
export const getReceptiveFieldInputNids: GetInputNidsFunc = (
  l,
  nIdx,
  prevLayer,
  prevLayerIdx,
  depthwise?: boolean, // for DepthwiseConv2D and MaxPooling2D
) => {
  const [filterHeight, filterWidth] = getFilterSize(l)
  const filterSize = filterHeight * filterWidth

  const outputShape = l.outputShape as number[]
  const prevShape = prevLayer.outputShape as number[]
  const [, prevHeight, prevWidth, depth] = prevShape
  const [top, left] = getReceptiveFieldOrigin(l, nIdx, prevLayer)
  const [, , thisDepth] = getIndex3d(nIdx, outputShape)

  const inputNids: Nid[] = []
  for (let k = 0; k < filterSize * depth; k++) {
    const depthIdx = k % depth
    if (depthwise && depthIdx !== thisDepth) continue
    const widthIdx = left + (Math.floor(k / depth) % filterWidth)
    const heightIdx = top + Math.floor(k / (depth * filterWidth))
    if (heightIdx < 0 || heightIdx >= prevHeight || widthIdx < 0 || widthIdx >= prevWidth) continue
    const flatIndex = getFlatIndex(heightIdx, widthIdx, depthIdx, prevShape)
    const inputNid = getNid(prevLayerIdx, flatIndex)
    inputNids.push(inputNid)
  }

  return inputNids
}

// [y, x] of the top left corner of the receptive field in the previous layer
// can be outside of the previous layer with "same" padding
export function getReceptiveFieldOrigin(l: Layer, nIdx: number, prevLayer: Layer) {
  const filterSize = getFilterSize(l)
  const strides = (l.getConfig().strides as number[]) ?? [1, 1]
  const outputShape = l.outputShape as number[]
  const prevShape = prevLayer.outputShape as number[]
  const index3d = getIndex3d(nIdx, outputShape)
  const isSame = l.getConfig().padding === "same"
  return [0, 1].map((axis) => {
    // same padding as in tf: the odd cell is padded at the end
    const outSize = outputShape[axis + 1]
    const inSize = prevShape[axis + 1]
    const padTotal = Math.max((outSize - 1) * strides[axis] + filterSize[axis] - inSize, 0)
    const padBefore = isSame ? Math.floor(padTotal / 2) : 0
    return index3d[axis] * strides[axis] - padBefore
  }) as [number, number]
}

function getFilterSize(l: Layer) {
  return (
    (l.getConfig().kernelSize as number[]) ??
    (l.getConfig().poolSize as number[]) ??
    ([] as number[])
  )
}
