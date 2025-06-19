import * as tf from "@tensorflow/tfjs"
import { MultiHeadAttention as MultiHeadAttentionLayer } from "@tensorflow/tfjs-layers/dist/layers/nlp/multihead_attention"
import { nameScope } from "@tensorflow/tfjs-layers/dist/common"
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

    // 2. Build the child layers to create weights
    nameScope(`${this.name}/query_dense`, () => {
      this.queryDense.build(queryShape)
    })
    nameScope(`${this.name}/key_dense`, () => {
      this.keyDense.build(keyShape ?? valueShape)
    })
    nameScope(`${this.name}/value_dense`, () => {
      this.valueDense.build(valueShape)
    })
    nameScope(`${this.name}/output_dense`, () => {
      this.outputDense.build([null, null, this.numHeads, this.valueDim]) // ??
    })

    // 3. Register the trainable weights
    this._trainableWeights.push(...this.queryDense.trainableWeights)
    this._trainableWeights.push(...this.keyDense.trainableWeights)
    this._trainableWeights.push(...this.valueDense.trainableWeights)
    this._trainableWeights.push(...this.outputDense.trainableWeights)
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
