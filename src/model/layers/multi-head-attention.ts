import * as tf from "@tensorflow/tfjs"
import { MultiHeadAttention as MultiHeadAttentionLayer } from "@tensorflow/tfjs-layers/dist/layers/nlp/multihead_attention"
import type { LayerDef } from "./types"

export const MultiHeadAttention: LayerDef<"MultiHeadAttention"> = {
  // @ts-expect-error with computeOutputShape
  constructorFunc: (config) => new MultiHeadAttentionLayer(config),
  defaultConfig: {
    numHeads: 1,
    keyDim: 32,
  },
  isUserAddable: false,
}

tf.serialization.registerClass(MultiHeadAttentionLayer)
