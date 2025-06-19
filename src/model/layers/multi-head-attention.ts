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

  buildFromSignature(
    queryShape: tf.Shape,
    valueShape: tf.Shape,
    keyShape: tf.Shape
  ) {
    // 1. Call the parent method to set up the layer
    super.buildFromSignature(queryShape, valueShape, keyShape)

    // 2. Build the sublayers to create weights
    this.queryDense.build(queryShape)
    this.keyDense.build(keyShape ?? valueShape)
    this.valueDense.build(valueShape)
    this.outputDense.build([null, null, this.numHeads, this.valueDim]) // ??

    // TODO: somehow track the sublayer weights to make them reusable for saving/loading
  }

  getWeights(trainableOnly?: boolean): tf.Tensor[] {
    return this.getSublayerWeights(trainableOnly)
  }

  getSublayerWeights(trainableOnly?: boolean): tf.Tensor[] {
    return [
      this.queryDense,
      this.keyDense,
      this.valueDense,
      this.outputDense,
    ].flatMap((l) => l.getWeights(trainableOnly))
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
