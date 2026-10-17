import * as tf from "@tensorflow/tfjs"
import {
  Layer,
  type LayerArgs,
  type SymbolicTensor,
} from "@tensorflow/tfjs-layers/dist/engine/topology"
import type { Kwargs } from "@tensorflow/tfjs-layers/dist/types"
import type { LayerVariable } from "@tensorflow/tfjs-layers/dist/variables"
import { causalAdder, getAttentionInputRange, type CachedKeysValues } from "./multi-head-attention"
import { rmsNormalize } from "./rms-normalization"
import type { LayerDef } from "./types"

// Self-attention with rotary position embeddings (RoPE) and fewer key/value heads than query heads (grouped
// query attention), optionally with qk-norm (RMSNorm over each head of the queries and keys, before RoPE),
// as in Llama, Qwen or LFM2 models. Same as RotaryGroupQueryAttention in ml-notebooks/lfm2.py (Keras'
// GroupQueryAttention + RoPE of keras_hub's RotaryEmbedding + qk-norm).
// references: https://github.com/keras-team/keras/blob/v3.15.1/keras/src/layers/attention/grouped_query_attention.py,
// https://github.com/keras-team/keras-hub/blob/v0.25.0/keras_hub/src/layers/modeling/rotary_embedding.py

export const RotaryGroupQueryAttention: LayerDef<"RotaryGroupQueryAttention"> = {
  constructorFunc: (args) => new RotaryGroupQueryAttentionLayer(args),
  isUserAddable: false,
  getInputRange: getAttentionInputRange,
  hasRegionInputsOnly: true,
}

export interface RotaryGroupQueryAttentionArgs extends LayerArgs {
  headDim: number
  numQueryHeads: number
  numKeyValueHeads: number
  useBias?: boolean // only false
  useGate?: boolean // only false
  slidingWindow?: number | null // only null
  dropout?: number // ignored (inference)
  ropeMaxWavelength?: number
  qkNormEpsilon?: number | null // null: no qk-norm
}

type Input = tf.Tensor | SymbolicTensor
const toList = <T>(x: T | T[]) => (Array.isArray(x) ? x : [x])
const toHeadsFirst = (t: tf.Tensor) => t.transpose([0, 2, 1, 3]) // [B, T, N, H] <-> [B, N, T, H]

// Layer from the ESM files of tfjs-layers, see multi-head-attention.ts
class RotaryGroupQueryAttentionLayer extends Layer {
  static className = "RotaryGroupQueryAttention"
  private headDim: number
  private numQueryHeads: number
  private numKeyValueHeads: number
  private ropeMaxWavelength: number
  private qkNormEpsilon: number | null
  // Keras: mha(x, x, use_causal_mask=True), kept on the layer as in Keras3MultiHeadAttentionLayer
  private useCausalMask = false
  private kernels!: Record<"query" | "key" | "value" | "output", LayerVariable>
  private norms?: Record<"query" | "key", LayerVariable>
  private rope?: { cos: tf.Tensor2D; sin: tf.Tensor2D } // [positions, headDim], see getRope
  private seqLen = 0 // of the model input, if fixed: the size of the RoPE table

  get isCausal() {
    return this.useCausalMask
  }

  constructor(args: RotaryGroupQueryAttentionArgs) {
    super(args)
    if (args.useBias || args.useGate || args.slidingWindow) {
      throw new Error(
        "RotaryGroupQueryAttention: use_bias, use_gate and sliding_window are not supported",
      )
    }
    if (args.numQueryHeads % args.numKeyValueHeads !== 0) {
      throw new Error(
        "RotaryGroupQueryAttention: num_query_heads must be divisible by num_key_value_heads",
      )
    }
    this.headDim = args.headDim
    this.numQueryHeads = args.numQueryHeads
    this.numKeyValueHeads = args.numKeyValueHeads
    this.ropeMaxWavelength = args.ropeMaxWavelength ?? 10000
    this.qkNormEpsilon = args.qkNormEpsilon ?? null
  }

  // weights as the sublayers in Keras (EinsumDense kernels "bqm,muh->bquh" etc., RMSNormalization scales),
  // in the order of import-keras.ts
  override build(inputShape: tf.Shape | tf.Shape[]): void {
    const shape = (Array.isArray(inputShape[0]) ? inputShape[0] : inputShape) as tf.Shape
    const dim = shape[shape.length - 1] as number
    this.seqLen = (shape[1] as number | null) ?? 0
    const [h, nq, nkv] = [this.headDim, this.numQueryHeads, this.numKeyValueHeads]
    const kernel = (name: string, kernelShape: number[]) =>
      this.addWeight(`${name}/kernel`, kernelShape, "float32", tf.initializers.glorotUniform({}))
    this.kernels = {
      query: kernel("query", [dim, nq, h]),
      key: kernel("key", [dim, nkv, h]),
      value: kernel("value", [dim, nkv, h]),
      output: kernel("attention_output", [nq, h, dim]),
    }
    if (this.qkNormEpsilon !== null) {
      const scale = (name: string) =>
        this.addWeight(`${name}/scale`, [h], "float32", tf.initializers.ones())
      this.norms = { query: scale("query_norm"), key: scale("key_norm") }
    }
    this.built = true
  }

  // self-attention only: [x, x] (as in Keras) is a single graph input, see Keras3MultiHeadAttentionLayer.apply
  override apply(inputs: Input | Input[], kwargs: Kwargs = {}) {
    if (kwargs.useCausalMask) this.useCausalMask = true
    const [query, value, key] = toList(inputs)
    const isSelfAttention = (!value || value === query) && (!key || key === query)
    if (!isSelfAttention)
      throw new Error("RotaryGroupQueryAttention: only self-attention is supported")
    return super.apply(query, kwargs)
  }

  override computeOutputShape(inputShape: tf.Shape | tf.Shape[]) {
    return (Array.isArray(inputShape[0]) ? inputShape[0] : inputShape) as tf.Shape
  }

  override call(inputs: tf.Tensor | tf.Tensor[]): tf.Tensor {
    return tf.tidy(() => this.attend(toList(inputs)[0]).output)
  }

  /**
   * Self-attention of new positions x [B, T, D] to the cached positions and themselves (KV cache, see
   * IncrementalActivations). Returns the output [B, T, D] and the keys and values of all positions
   * [B, numKeyValueHeads, S, H] (after qk-norm and RoPE).
   */
  attendWithCache(x: tf.Tensor, cached?: CachedKeysValues) {
    return this.attend(x, cached)
  }

  private attend(x: tf.Tensor, cached?: CachedKeysValues) {
    const [batch, numQueries, dim] = x.shape as [number, number, number]
    const [h, nq, nkv] = [this.headDim, this.numQueryHeads, this.numKeyValueHeads]
    const offset = cached?.key.shape[2] ?? 0 // position of the first query
    const flat = x.reshape([-1, dim])
    const project = (kernel: LayerVariable, heads: number) =>
      flat.matMul(kernel.read().reshape([dim, heads * h])).reshape([batch, numQueries, heads, h])
    let [q, k] = [project(this.kernels.query, nq), project(this.kernels.key, nkv)]
    const v = project(this.kernels.value, nkv)
    if (this.norms) {
      const epsilon = this.qkNormEpsilon!
      q = rmsNormalize(q, this.norms.query.read(), epsilon)
      k = rmsNormalize(k, this.norms.key.read(), epsilon)
    }
    const [cos, sin] = this.getRope(offset, numQueries)
    ;[q, k] = [applyRope(q, cos, sin), applyRope(k, cos, sin)]

    const [newKey, newValue] = [toHeadsFirst(k), toHeadsFirst(v)] // [B, nkv, T, H]
    const key = cached ? tf.concat([cached.key, newKey], 2) : newKey // [B, nkv, S, H]
    const value = cached ? tf.concat([cached.value, newValue], 2) : newValue
    // the query heads of a group share a key/value head (consecutive heads, as Keras' ops.repeat): the group's
    // queries in one matMul with its keys, no copies of the keys and values
    const groupSize = nq / nkv
    const groupedQ = toHeadsFirst(q.mul(1 / Math.sqrt(h))).reshape([
      batch,
      nkv,
      groupSize * numQueries,
      h,
    ])
    const numKeys = offset + numQueries
    let scores = tf.matMul(groupedQ, key, false, true).reshape([batch, nq, numQueries, numKeys])
    if (this.useCausalMask && numQueries > 1) scores = scores.add(causalAdder(numQueries, offset))
    const weights = tf.softmax(scores).reshape([batch, nkv, groupSize * numQueries, numKeys])
    const attended = tf.matMul(weights, value).reshape([batch, nq, numQueries, h]) // [B, nq, T, H]
    const output = toHeadsFirst(attended)
      .reshape([-1, nq * h])
      .matMul(this.kernels.output.read().reshape([nq * h, dim]))
      .reshape([batch, numQueries, dim])
    return { output, key, value }
  }

  // cos and sin of the rotation angles for the positions offset .. offset + length - 1 [length, headDim]:
  // position * 1 / maxWavelength^(2i / headDim) for i < headDim / 2, repeated for the 2nd half of the features.
  // The table grows as needed and is kept (positions up to the sequence length of the model)
  private getRope(offset: number, length: number) {
    const numPositions = offset + length
    if (!this.rope || this.rope.cos.shape[0] < numPositions) {
      if (this.rope) tf.dispose([this.rope.cos, this.rope.sin])
      const size = Math.max(numPositions, this.seqLen)
      const half = this.headDim / 2
      const [cos, sin] = [
        new Float32Array(size * this.headDim),
        new Float32Array(size * this.headDim),
      ]
      for (let p = 0; p < size; p++) {
        for (let i = 0; i < half; i++) {
          const angle = p / this.ropeMaxWavelength ** ((2 * i) / this.headDim)
          for (const j of [i, i + half]) {
            cos[p * this.headDim + j] = Math.cos(angle)
            sin[p * this.headDim + j] = Math.sin(angle)
          }
        }
      }
      this.rope = {
        cos: tf.keep(tf.tensor2d(cos, [size, this.headDim])),
        sin: tf.keep(tf.tensor2d(sin, [size, this.headDim])),
      }
    }
    return [this.rope.cos, this.rope.sin].map((t) => t.slice([offset, 0], [length, -1]))
  }

  override dispose() {
    if (this.rope) tf.dispose([this.rope.cos, this.rope.sin])
    this.rope = undefined
    return super.dispose()
  }

  override getConfig(): tf.serialization.ConfigDict {
    const config = {
      headDim: this.headDim,
      numQueryHeads: this.numQueryHeads,
      numKeyValueHeads: this.numKeyValueHeads,
      useBias: false,
      ropeMaxWavelength: this.ropeMaxWavelength,
      qkNormEpsilon: this.qkNormEpsilon,
    }
    return { ...super.getConfig(), ...config }
  }
}

// rotates the pairs of features (i, i + headDim / 2) of x [B, T, N, H] by the angles of the positions (cos, sin:
// [T, H]): x * cos + [-x2, x1] * sin, as keras_hub's RotaryEmbedding and Hugging Face's rotate_half
function applyRope(x: tf.Tensor, cos: tf.Tensor, sin: tf.Tensor) {
  return tf.tidy(() => {
    const [numPositions, headDim] = cos.shape
    const [x1, x2] = tf.split(x, 2, -1)
    const rotated = tf.concat([x2.neg(), x1], -1)
    const shape = [1, numPositions, 1, headDim] // broadcast over batch and heads
    return x.mul(cos.reshape(shape)).add(rotated.mul(sin.reshape(shape)))
  })
}

tf.serialization.registerClass(RotaryGroupQueryAttentionLayer)
