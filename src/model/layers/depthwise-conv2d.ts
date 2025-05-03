import * as tf from "@tensorflow/tfjs"
import { getReceptiveFieldInputNids } from "./get-input-nids"
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
  isUserAddable: true,
  options: [
    {
      name: "depthMultiplier",
      inputType: "slider",
      min: 1,
      max: 10,
    },
  ],
  // TODO: adjust for higher depthMultiplier ?
  getInputNids: (l, nIdx, prevLayer, prevLayerIdx) =>
    getReceptiveFieldInputNids(l, nIdx, prevLayer, prevLayerIdx, true),
}
