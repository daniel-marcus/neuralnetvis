import * as tf from "@tensorflow/tfjs"
import type { LayerDef } from "./types"

export const Dropout: LayerDef<"Dropout"> = {
  constructorFunc: tf.layers.dropout,
  defaultConfig: {
    rate: 0.2,
  },
  options: [
    {
      name: "rate",
      inputType: "slider",
      min: 0,
      max: 0.95,
      step: 0.05,
    },
  ],
}
