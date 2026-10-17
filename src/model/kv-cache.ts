import * as tf from "@tensorflow/tfjs"
import { getExecutionOrder } from "./get-layer-activations"

// decoder-only transformers (tweets, TinyStories, GPT-2): only the attention layers mix positions
const SUPPORTED_LAYERS = new Set([
  "InputLayer",
  "Embedding",
  "ReversibleEmbedding",
  "PositionEmbedding",
  "MultiHeadAttention",
  "LayerNormalization",
  "Dense",
  "Dropout",
  "Activation",
  "Add",
])

// fields of tfjs' MultiHeadAttention that are protected in its typings
type AttentionInternals = Record<
  "queryDense" | "keyDense" | "valueDense" | "outputDense",
  tf.layers.Layer
> & { keyDim: number }

const toHeadsFirst = (t: tf.Tensor) => t.transpose([0, 2, 1, 3]) // [B, T, N, H] <-> [B, N, T, H]

/**
 * Next-token prediction without recomputing the previous positions (autocomplete): the attention layers keep
 * the keys and values of all positions so far, the other layers compute each position on its own.
 * Runs only the tokens (no padding), only the output of the model (no activations for the visualization).
 */
export class KVCache {
  private cache = new Map<tf.layers.Layer, { key: tf.Tensor; value: tf.Tensor }>() // [1, N, S, H]
  private order: tf.SymbolicTensor[]
  length = 0 // number of cached positions

  constructor(private model: tf.LayersModel) {
    this.order = getExecutionOrder(model.outputs)
    const unsupported = this.order.find((t) => !SUPPORTED_LAYERS.has(t.sourceLayer.getClassName()))
    if (unsupported)
      throw new Error(`KV cache: ${unsupported.sourceLayer.getClassName()} not supported`)
  }

  // appends the tokens (prompt or the next token), returns the probabilities for the next one [vocab]
  append(tokens: number[]): tf.Tensor1D {
    const offset = this.length
    const probs = tf.tidy(() => {
      const input = tf.tensor2d([tokens], [1, tokens.length], "int32")
      const values = new Map<tf.SymbolicTensor, tf.Tensor>([[this.model.inputs[0], input]])
      const mask = tokens.length > 1 ? causalMask(tokens.length, offset) : undefined
      for (const symbolic of this.order) {
        if (values.has(symbolic)) continue
        const layer = symbolic.sourceLayer
        const inputs = symbolic.inputs.map((t) => values.get(t)!)
        const className = layer.getClassName()
        const output =
          className === "MultiHeadAttention"
            ? this.attention(layer, inputs[0], mask)
            : className === "PositionEmbedding"
              ? layer.apply(inputs, { startIndex: offset })
              : layer.apply(inputs)
        values.set(symbolic, output as tf.Tensor)
      }
      const output = values.get(this.model.outputs[0])! // [1, T, vocab]
      return output.slice([0, tokens.length - 1], [1, 1]).reshape([-1]) as tf.Tensor1D
    })
    this.length += tokens.length
    return probs
  }

  // self-attention of the new positions to all positions so far
  private attention(layer: tf.layers.Layer, x: tf.Tensor, mask?: tf.Tensor) {
    const mha = layer as unknown as AttentionInternals
    const project = (dense: tf.layers.Layer) => toHeadsFirst(dense.apply(x) as tf.Tensor) // [1, N, T, H]
    const prev = this.cache.get(layer)
    const [newKey, newValue] = [project(mha.keyDense), project(mha.valueDense)]
    const key = tf.keep(prev ? tf.concat([prev.key, newKey], 2) : newKey) // [1, N, S, H]
    const value = tf.keep(prev ? tf.concat([prev.value, newValue], 2) : newValue)
    if (prev) tf.dispose([prev.key, prev.value])
    this.cache.set(layer, { key, value })

    const query = project(mha.queryDense).mul(1 / Math.sqrt(mha.keyDim))
    const scores = tf.matMul(query, key, false, true) // [1, N, T, S]
    const weights = tf.softmax(mask ? scores.add(mask) : scores)
    const output = toHeadsFirst(tf.matMul(weights, value)) // [1, T, N, H]
    return mha.outputDense.apply(output) as tf.Tensor // [1, T, D]
  }

  dispose() {
    for (const { key, value } of this.cache.values()) tf.dispose([key, value])
    this.cache.clear()
    this.length = 0
  }
}

// [T, S] added to the scores: 0 for the keys up to the query's position (offset + i), -1e9 for later ones
function causalMask(numQueries: number, offset: number) {
  const allowed = tf.linalg.bandPart(tf.ones([numQueries, offset + numQueries]), -1, offset)
  return tf.scalar(1).sub(allowed).mul(-1e9)
}
