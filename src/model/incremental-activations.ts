import * as tf from "@tensorflow/tfjs"
import { getExecutionOrder } from "./get-layer-activations"
import { ZeroPadding1DLayer } from "./layers/zero-padding1d"
import type { CachedKeysValues } from "./layers/multi-head-attention"

// decoder-only transformers (tweets, TinyStories, GPT-2, LFM2): only the attention layers and the causal
// convolutions (ZeroPadding1D + DepthwiseConv1D) mix positions
const SUPPORTED_LAYERS = new Set([
  "InputLayer",
  "Embedding",
  "ReversibleEmbedding",
  "PositionEmbedding",
  "MultiHeadAttention",
  "RotaryGroupQueryAttention",
  "LayerNormalization",
  "RMSNormalization",
  "Dense",
  "Dropout",
  "Activation",
  "Add",
  "Multiply",
  "ZeroPadding1D",
  "DepthwiseConv1D",
])

// MultiHeadAttention, RotaryGroupQueryAttention
type CachedAttentionLayer = tf.layers.Layer & {
  attendWithCache: (
    x: tf.Tensor,
    cached?: CachedKeysValues,
  ) => CachedKeysValues & { output: tf.Tensor }
}
const isCachedAttention = (layer: tf.layers.Layer): layer is CachedAttentionLayer =>
  typeof (layer as Partial<CachedAttentionLayer>).attendWithCache === "function"

/**
 * Activations of the visualized layers for a growing text (autocomplete, typing at the end): only the new
 * positions are computed, the previous ones are kept. The attention layers cache the keys and values of all
 * positions so far (KV cache), the causal paddings of convolutions the last positions before the new ones,
 * the other layers compute each position on its own. An edited text starts over.
 * Only the text's tokens are computed: padding positions are zeros (full forward pass: padding tokens).
 */
export class IncrementalActivations {
  private tokens: number[] = []
  private rows = new Map<tf.SymbolicTensor, tf.Tensor>() // [1, L, ...]: the positions so far
  private cache = new Map<tf.layers.Layer, CachedKeysValues>() // per attention layer
  private convInputs = new Map<tf.layers.Layer, tf.Tensor>() // per ZeroPadding1D: its last inputs [1, before, C]
  private order: tf.SymbolicTensor[]
  private isDisposed = false

  constructor(
    private model: tf.LayersModel,
    private outputs: tf.SymbolicTensor[], // all visualized layers
  ) {
    this.order = getExecutionOrder(model.outputs)
    const unsupported = this.order.find((t) => !isSupported(t))
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
        const output = isCachedAttention(layer)
          ? this.attend(layer, inputs[0])
          : className === "PositionEmbedding"
            ? layer.apply(inputs, { startIndex: offset })
            : layer instanceof ZeroPadding1DLayer
              ? this.padCausal(layer, inputs[0])
              : layer.apply(inputs)
        values.set(symbolic, output as tf.Tensor)
      }
      return this.outputs.map((t) => values.get(t)!)
    })
  }

  private attend(layer: CachedAttentionLayer, x: tf.Tensor) {
    const prev = this.cache.get(layer)
    const { output, key, value } = layer.attendWithCache(x, prev)
    this.cache.set(layer, { key: tf.keep(key), value: tf.keep(value) })
    if (prev) tf.dispose([prev.key, prev.value])
    return output
  }

  // causal padding [before, 0] of the new positions x [1, T, C]: the inputs of the previous positions instead of
  // zeros (at the start of the text: zeros), so that the following DepthwiseConv1D (valid) computes the new ones
  private padCausal(layer: ZeroPadding1DLayer, x: tf.Tensor) {
    const [before] = layer.padding
    const prev = this.convInputs.get(layer) ?? tf.zeros([1, before, x.shape[2]!])
    const padded = tf.concat([prev, x], 1)
    this.convInputs.set(layer, tf.keep(padded.slice([0, padded.shape[1]! - before], [1, before])))
    prev.dispose()
    return padded
  }

  reset() {
    tf.dispose([...this.rows.values()])
    this.rows.clear()
    for (const { key, value } of this.cache.values()) tf.dispose([key, value])
    this.cache.clear()
    tf.dispose([...this.convInputs.values()])
    this.convInputs.clear()
    this.tokens = []
  }

  dispose() {
    this.reset()
    this.isDisposed = true
  }
}

// convolutions only after a causal padding (kernelSize - 1 before, none after), see padCausal
function isSupported({ sourceLayer: layer, inputs }: tf.SymbolicTensor) {
  const className = layer.getClassName()
  if (!SUPPORTED_LAYERS.has(className)) return false
  if (layer instanceof ZeroPadding1DLayer) return layer.padding[1] === 0
  if (className !== "DepthwiseConv1D") return true
  const padding = inputs[0]?.sourceLayer
  const { kernelSize } = layer as tf.layers.Layer & { kernelSize: number }
  return padding instanceof ZeroPadding1DLayer && padding.padding[0] === kernelSize - 1
}
