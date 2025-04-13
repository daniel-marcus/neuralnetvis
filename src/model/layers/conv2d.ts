import * as tf from "@tensorflow/tfjs"
import type { Layer } from "@tensorflow/tfjs-layers/dist/exports_layers"
import type { LayerDef } from "./types"
import type { Index3D, Nid } from "@/neuron-layers"
import { getIndex3d, getNid, getUnits } from "@/neuron-layers/layers-stateless"

export const Conv2D: LayerDef<"Conv2D"> = {
  constructorFunc: tf.layers.conv2d,
  defaultConfig: {
    filters: 4,
    kernelSize: 3,
    activation: "relu",
    padding: "same",
  },
  needsMultiDim: true,
  options: [
    {
      name: "filters",
      inputType: "slider",
      min: 0,
      max: 6, // 2^6 = 64
      transformToSliderVal: (v) => Math.log2(v),
      transformFromSliderVal: (v) => 2 ** v,
    },
  ],
  getInputNids: getConv2DInputNids,
}

export function getConv2DInputNids(
  l: Layer,
  prev: Layer,
  prevIdx: number,
  depthwise?: boolean // for DepthwiseConv2D and MaxPooling2D
): Nid[][] {
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
  const prevOutputShape = prev.outputShape as number[]
  const depth = prevOutputShape[3]

  const units = getUnits(l)

  const inputNids: Nid[][] = []
  // TODO: padding?
  for (let j = 0; j < units; j++) {
    const unitInputNids: Nid[] = []
    for (let k = 0; k < filterSize * depth; k++) {
      const [thisY, thisX, thisDepth] = getIndex3d(j, outputShape)
      const depthIndex = k % depth
      if (depthwise && depthIndex !== thisDepth) continue
      const widthIndex =
        thisX * strideWidth + (Math.floor(k / depth) % filterWidth)
      const heightIndex =
        thisY * strideHeight + Math.floor(k / (depth * filterWidth))
      const index3d = [heightIndex, widthIndex, depthIndex] as Index3D
      const inputNid = getNid(prevIdx, index3d)
      unitInputNids.push(inputNid)
    }
    inputNids.push(unitInputNids)
  }
  return inputNids
}
