import * as tf from "@tensorflow/tfjs"
import { getReceptiveFieldInputNids } from "./get-input-nids"
import type { LayerDef } from "./types"

export const MaxPooling2D: LayerDef<"MaxPooling2D"> = {
  constructorFunc: tf.layers.maxPooling2d,
  defaultConfig: {
    poolSize: 2,
  },
  needsMultiDim: true,
  isUserAddable: true,
  getInputNids: (l, nIdx, prevLayer, prevLayerIdx) =>
    getReceptiveFieldInputNids(l, nIdx, prevLayer, prevLayerIdx, true),
}
