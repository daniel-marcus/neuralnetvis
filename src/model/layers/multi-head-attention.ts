import * as tf from "@tensorflow/tfjs"
import { MultiHeadAttention as MultiHeadAttentionLayer } from "@tensorflow/tfjs-layers/dist/layers/nlp/multihead_attention"
import type { LayerDef } from "./types"

class Keras3MultiHeadAttentionLayer extends MultiHeadAttentionLayer {
  // @ts-expect-error inputs type
  apply(inputs, kwargs = {}) {
    const [query, value, key] = inputs
    const newKwargs = { ...kwargs, value, key }
    return super.apply(query, newKwargs)
  }
  // @ts-expect-error inputs type
  call(inputs, kwargs = {}) {
    const [query, value, key] = inputs
    const newKwargs = { ...kwargs, value, key }
    return super.call(query, newKwargs)
  }
}

export const MultiHeadAttention: LayerDef<"MultiHeadAttention"> = {
  // @ts-expect-error with computeOutputShape
  constructorFunc: (config) => new Keras3MultiHeadAttentionLayer(config),
  defaultConfig: {
    numHeads: 1,
    keyDim: 32,
  },
  isUserAddable: false,
}

tf.serialization.registerClass(Keras3MultiHeadAttentionLayer)
