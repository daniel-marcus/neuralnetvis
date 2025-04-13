import * as tf from "@tensorflow/tfjs"
import { getConv2DInputNids } from "./conv2d"
import type { LayerDef } from "./types"

export const DepthwiseConv2D: LayerDef<"DepthwiseConv2D"> = {
  constructorFunc: tf.layers.depthwiseConv2d,
  defaultConfig: {
    kernelSize: 3,
    depthMultiplier: 1,
    activation: "relu",
    padding: "same",
  },
  needsMultiDim: true,

  options: [
    {
      name: "depthMultiplier",
      inputType: "slider",
      min: 1,
      max: 10,
    },
  ],
  getInputNids: (
    l,
    prev,
    prevIdx // TODO: adjust for higher depthMultiplier
  ) => getConv2DInputNids(l, prev, prevIdx, true),
}
