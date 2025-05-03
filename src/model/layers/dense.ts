import * as tf from "@tensorflow/tfjs"
import { getFullyConnectedInputNids } from "./get-input-nids"
import type { LayerDef } from "./types"

export const Dense: LayerDef<"Dense"> = {
  constructorFunc: tf.layers.dense,
  defaultConfig: {
    units: 64,
    activation: "relu",
  },
  options: [
    {
      name: "units",
      inputType: "slider",
      min: 0,
      max: 9, // 0^9 = 512
      transformToSliderVal: (v) => Math.log2(v),
      transformFromSliderVal: (v) => 2 ** v,
    },
  ],
  isUserAddable: true,
  getInputNids: getFullyConnectedInputNids,
}
