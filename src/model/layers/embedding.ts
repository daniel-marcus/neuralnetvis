import * as tf from "@tensorflow/tfjs"
import type { LayerDef } from "./types"

export const Embedding: LayerDef<"Embedding"> = {
  constructorFunc: tf.layers.embedding,
  defaultConfig: {
    inputDim: 65, // vocabulary size
    outputDim: 32, // dimension of the dense embedding
  },
  options: [
    {
      name: "outputDim",
      inputType: "slider",
      min: 1,
      max: 32,
    },
  ],
  isUserAddable: true,
}
