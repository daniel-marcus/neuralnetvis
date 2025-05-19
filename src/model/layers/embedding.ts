import * as tf from "@tensorflow/tfjs"
import type { LayerDef } from "./types"

export const Embedding: LayerDef<"Embedding"> = {
  constructorFunc: tf.layers.embedding,
  defaultConfig: {
    inputDim: 256, // vocabulary size
    outputDim: 16, // dimension of the dense embedding
  },
  isUserAddable: true,
}
