import * as tf from "@tensorflow/tfjs"
import { getReceptiveFieldInputNids } from "./get-input-nids"
import type { LayerDef } from "./types"

export const Conv2D: LayerDef<"Conv2D"> = {
  constructorFunc: tf.layers.conv2d,
  defaultConfig: {
    filters: 4,
    kernelSize: 3,
    activation: "relu",
    padding: "same",
  },
  needsMultiDim: true,
  isUserAddable: true,
  options: [
    {
      name: "filters",
      inputType: "slider",
      min: 0,
      max: 6, // 2^6 = 64
      transformToSliderVal: (v) => Math.log2(v),
      transformFromSliderVal: (v) => Math.round(2 ** v),
    },
  ],
  getInputNids: getReceptiveFieldInputNids,
}
