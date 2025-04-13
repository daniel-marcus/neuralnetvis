import * as tf from "@tensorflow/tfjs"
import type { LayerDef } from "./types"
import { getConv2DInputNids } from "./conv2d"

export const MaxPooling2D: LayerDef<"MaxPooling2D"> = {
  constructorFunc: tf.layers.maxPooling2d,
  defaultConfig: {
    poolSize: 2,
  },
  needsMultiDim: true,
  getInputNids: (l, prev, prevIdx) =>
    getConv2DInputNids(l, prev, prevIdx, true),
}
