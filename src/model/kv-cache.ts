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
 * Runs only the tokens (no padding).
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

  // appends the tokens (prompt or the next token), returns the outputs at their positions [1, T, ...]
  append(tokens: number[], outputs = this.model.outputs): tf.Tensor[] {
    const offset = this.length
    const result = tf.tidy(() => {
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
      return outputs.map((t) => values.get(t)!)
    })
    this.length += tokens.length
    return result
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

/**
 * Activations of the visualized layers for a growing text (autocomplete, typing at the end): only the new
 * positions are computed (KV cache), the previous ones are kept. Otherwise starts over with the whole text.
 * Padding positions are zeros (full forward pass: the activations for the padding tokens).
 */
export class IncrementalActivations {
  private cache: KVCache
  private tokens: number[] = []
  private rows = new Map<tf.SymbolicTensor, tf.Tensor>() // [1, L, ...]: the positions so far
  private isDisposed = false

  constructor(
    private model: tf.LayersModel,
    private outputs: tf.SymbolicTensor[], // all visualized layers
  ) {
    this.cache = new KVCache(model)
  }

  // [1, seqLen, ...] for the requested outputs, the model output only at the last token [1, 1, ...]
  // undefined if disposed in the meantime (e.g. new model)
  update(tokens: number[], requested: tf.SymbolicTensor[]): tf.Tensor[] | undefined {
    if (this.isDisposed) return
    const isAppended = this.tokens.every((token, i) => token === tokens[i])
    if (!isAppended || tokens.length < this.tokens.length) this.reset()
    const newTokens = tokens.slice(this.tokens.length)
    if (newTokens.length) this.append(newTokens)
    const seqLen = this.model.inputs[0].shape[1]!
    return tf.tidy(() =>
      requested.map((output) => {
        const rows = this.rows.get(output)!
        if (output === this.model.outputs[0]) return rows.clone()
        const padding = rows.shape.map((size, axis) => [0, axis === 1 ? seqLen - size : 0])
        return tf.pad(rows, padding as [number, number][])
      }),
    )
  }

  private append(newTokens: number[]) {
    const newRows = this.cache.append(newTokens, this.outputs)
    for (const [i, output] of this.outputs.entries()) {
      const prev = this.rows.get(output)
      const isModelOutput = output === this.model.outputs[0] // only the last position (vocabulary size)
      const rows = tf.tidy(() =>
        isModelOutput
          ? newRows[i].slice([0, newTokens.length - 1], [1, 1])
          : prev
            ? tf.concat([prev, newRows[i]], 1)
            : newRows[i].clone(),
      )
      this.rows.set(output, rows)
      tf.dispose([prev, newRows[i]].filter((t) => !!t))
    }
    this.tokens.push(...newTokens)
  }

  private reset() {
    tf.dispose([...this.rows.values()])
    this.rows.clear()
    this.cache.dispose()
    this.tokens = []
  }

  dispose() {
    this.reset()
    this.isDisposed = true
  }
}

// [T, S] added to the scores: 0 for the keys up to the query's position (offset + i), -1e9 for later ones
function causalMask(numQueries: number, offset: number) {
  const allowed = tf.linalg.bandPart(tf.ones([numQueries, offset + numQueries]), -1, offset)
  return tf.scalar(1).sub(allowed).mul(-1e9)
}
