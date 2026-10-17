import * as tf from "@tensorflow/tfjs"
import { getExecutionOrder } from "./get-layer-activations"
import { attendWithCache, type CachedKeysValues } from "./layers/multi-head-attention"

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

/**
 * Activations of the visualized layers for a growing text (autocomplete, typing at the end): only the new
 * positions are computed, the previous ones are kept. The attention layers cache the keys and values of all
 * positions so far (KV cache), the other layers compute each position on its own. An edited text starts over.
 * Only the text's tokens are computed: padding positions are zeros (full forward pass: padding tokens).
 */
export class IncrementalActivations {
  private tokens: number[] = []
  private rows = new Map<tf.SymbolicTensor, tf.Tensor>() // [1, L, ...]: the positions so far
  private cache = new Map<tf.layers.Layer, CachedKeysValues>() // per attention layer
  private order: tf.SymbolicTensor[]
  private isDisposed = false

  constructor(
    private model: tf.LayersModel,
    private outputs: tf.SymbolicTensor[], // all visualized layers
  ) {
    this.order = getExecutionOrder(model.outputs)
    const unsupported = this.order.find((t) => !SUPPORTED_LAYERS.has(t.sourceLayer.getClassName()))
    if (unsupported) throw new Error(`${unsupported.sourceLayer.getClassName()} not supported`)
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
    const newRows = this.run(newTokens)
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

  // the outputs at the new positions [1, T, ...], walks the model graph with only the new tokens
  private run(newTokens: number[]) {
    const offset = this.tokens.length
    return tf.tidy(() => {
      const input = tf.tensor2d([newTokens], [1, newTokens.length], "int32")
      const values = new Map<tf.SymbolicTensor, tf.Tensor>([[this.model.inputs[0], input]])
      for (const symbolic of this.order) {
        if (values.has(symbolic)) continue
        const layer = symbolic.sourceLayer
        const inputs = symbolic.inputs.map((t) => values.get(t)!)
        const className = layer.getClassName()
        const output =
          className === "MultiHeadAttention"
            ? this.attend(layer, inputs[0])
            : className === "PositionEmbedding"
              ? layer.apply(inputs, { startIndex: offset })
              : layer.apply(inputs)
        values.set(symbolic, output as tf.Tensor)
      }
      return this.outputs.map((t) => values.get(t)!)
    })
  }

  private attend(layer: tf.layers.Layer, x: tf.Tensor) {
    const prev = this.cache.get(layer)
    const { output, key, value } = attendWithCache(layer, x, prev)
    this.cache.set(layer, { key: tf.keep(key), value: tf.keep(value) })
    if (prev) tf.dispose([prev.key, prev.value])
    return output
  }

  reset() {
    tf.dispose([...this.rows.values()])
    this.rows.clear()
    for (const { key, value } of this.cache.values()) tf.dispose([key, value])
    this.cache.clear()
    this.tokens = []
  }

  dispose() {
    this.reset()
    this.isDisposed = true
  }
}
