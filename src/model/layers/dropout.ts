import * as tf from "@tensorflow/tfjs"
import { getOneToOneInputNids } from "./get-input-nids"
import type { LayerDef } from "./types"

export const Dropout: LayerDef<"Dropout"> = {
  constructorFunc: tf.layers.dropout,
  defaultConfig: {
    rate: 0.2,
  },
  isInvisible: true,
  isUserAddable: true,
  options: [
    {
      name: "rate",
      inputType: "slider",
      min: 0,
      max: 0.95,
      step: 0.05,
    },
  ],
  getInputNids: getOneToOneInputNids,
}
