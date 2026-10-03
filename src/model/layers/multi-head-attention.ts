import * as tf from "@tensorflow/tfjs"
import { MultiHeadAttention as MultiHeadAttentionLayer } from "@tensorflow/tfjs-layers/dist/layers/nlp/multihead_attention"
import { Layer, type SymbolicTensor } from "@tensorflow/tfjs-layers/dist/engine/topology"
import { nameScope } from "@tensorflow/tfjs-layers/dist/common"
import type { Kwargs } from "@tensorflow/tfjs-layers/dist/types"
import type { LayerDef } from "./types"

type Input = tf.Tensor | SymbolicTensor
const toList = <T>(x: T | T[]) => (Array.isArray(x) ? x : [x])

class Keras3MultiHeadAttentionLayer extends MultiHeadAttentionLayer {
  // inputs: [query, value, key?] as in Keras 3, or a single tensor for self-attention
  apply(inputs: Input | Input[], kwargs: Kwargs = {}) {
    const [query, value, key] = toList(inputs)
    const isSelfAttention = (!value || value === query) && (!key || key === query)
    if (!isSelfAttention) return super.apply(query as tf.Tensor, { ...kwargs, value, key })
    // Self-attention gets a single graph input: with [x, x], tfjs' executor disposes x too early in
    // predict/evaluate ("Tensor is disposed") and stores tensors in non-serializable kwargs
    if (!this.builtFromSignature) this.buildFromSignature(query.shape, query.shape, query.shape)
    return Layer.prototype.apply.call(this, query, kwargs)
  }
  call(inputs: tf.Tensor | tf.Tensor[], kwargs: Kwargs = {}) {
    const [query, value = query, key] = toList(inputs)
    return super.call(query, { ...kwargs, value, key })
  }

  computeOutputShape(inputShape: tf.Shape | [tf.Shape, tf.Shape, tf.Shape | null]) {
    const isSingleShape = !Array.isArray(inputShape[0])
    const shape = inputShape as tf.Shape
    const shapes = inputShape as [tf.Shape, tf.Shape, tf.Shape | null]
    return super.computeOutputShape(isSingleShape ? [shape, shape, null] : shapes)
  }

  getAttentionScores(query: tf.Tensor, value = query, key?: tf.Tensor) {
    // returns [batch, numHeads, queryLength, keyLength]
    return tf.tidy(() => this.callAndReturnAttentionScores(query, { value, key })[1])
  }

  buildFromSignature(queryShape: tf.Shape, valueShape: tf.Shape, keyShape: tf.Shape) {
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
