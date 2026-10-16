import * as tf from "@tensorflow/tfjs"
import { MultiHeadAttention as MultiHeadAttentionLayer } from "@tensorflow/tfjs-layers/dist/layers/nlp/multihead_attention"
import { Layer, type SymbolicTensor } from "@tensorflow/tfjs-layers/dist/engine/topology"
import { nameScope } from "@tensorflow/tfjs-layers/dist/common"
import type { EinsumDense } from "@tensorflow/tfjs-layers/dist/layers/nlp/einsum_dense"
import type { Kwargs } from "@tensorflow/tfjs-layers/dist/types"
import { getUnits } from "@/neuron-layers/helpers"
import type { GetInputRangeFunc, LayerDef } from "./types"

type Input = tf.Tensor | SymbolicTensor
const toList = <T>(x: T | T[]) => (Array.isArray(x) ? x : [x])
const prod = (dims: number[]) => dims.reduce((a, b) => a * b, 1)
const toHeadsFirst = (t: tf.Tensor) => t.transpose([0, 2, 1, 3]) // [B, T, N, H] <-> [B, N, T, H]

type CausalMask = { mask: tf.Tensor; adder: tf.Tensor }

class Keras3MultiHeadAttentionLayer extends MultiHeadAttentionLayer {
  // Keras: mha(x, x, use_causal_mask=True). tfjs stores call kwargs on the node (and serializes them),
  // but predict/evaluate/fit don't pass them to call(), so keep it on the layer
  private useCausalMask = false
  // the causal mask only depends on the sequence lengths: computed once instead of in every call
  // (tfjs: bandPart + the additive mask for the softmax, ~20 kernels per call)
  private causalMasks = new Map<string, CausalMask>()

  get isCausal() {
    return this.useCausalMask
  }

  constructor(args: ConstructorParameters<typeof MultiHeadAttentionLayer>[0]) {
    super(args)
    // computeCausalMask is private in tfjs' typings, so it can't be overridden as a method
    const self = this as unknown as {
      computeCausalMask: (q: tf.Tensor, v?: tf.Tensor) => tf.Tensor
    }
    self.computeCausalMask = (query, value) => this.getCausalMask(query, value).mask
  }

  private getCausalMask(query: tf.Tensor, value?: tf.Tensor) {
    const [qSeqLength, vSeqLength] = [query.shape[1]!, (value ?? query).shape[1]!]
    const cacheKey = `${qSeqLength}x${vSeqLength}`
    let cached = this.causalMasks.get(cacheKey)
    if (!cached) {
      cached = tf.tidy(() => {
        // lower triangular matrix [1, T, S], as tfjs' computeCausalMask
        const mask = tf.linalg.bandPart(tf.ones([1, qSeqLength, vSeqLength], "bool"), -1, 0)
        // [1, 1, T, S] (broadcast over the heads): 0 for attended positions, -1e9 for masked ones,
        // as in tfjs' Softmax layer with a mask
        const adder = tf
          .ones(mask.shape)
          .sub(mask.cast("float32"))
          .mul(tf.scalar(-1e9))
          .expandDims(1)
        return { mask: tf.keep(mask), adder: tf.keep(adder) }
      })
      this.causalMasks.set(cacheKey, cached)
    }
    return cached
  }

  protected maskedSoftmax(attentionScores: tf.Tensor, attentionMask?: tf.Tensor) {
    const causal = [...this.causalMasks.values()].find(({ mask }) => mask === attentionMask)
    const isSequenceAttention = attentionScores.rank === 4 && this.attentionAxes.length === 1
    if (!causal || !isSequenceAttention) return super.maskedSoftmax(attentionScores, attentionMask)
    return tf.tidy(() => tf.softmax(attentionScores.add(causal.adder))) // [B, N, T, S], softmax over S
  }

  dispose() {
    for (const { mask, adder } of this.causalMasks.values()) tf.dispose([mask, adder])
    this.causalMasks.clear()
    return super.dispose()
  }

  // inputs: [query, value, key?] as in Keras 3, or a single tensor for self-attention
  apply(inputs: Input | Input[], kwargs: Kwargs = {}) {
    if (kwargs.useCausalMask) this.useCausalMask = true
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
    return super.call(query, { useCausalMask: this.useCausalMask, ...kwargs, value, key })
  }

  computeOutputShape(inputShape: tf.Shape | [tf.Shape, tf.Shape, tf.Shape | null]) {
    const isSingleShape = !Array.isArray(inputShape[0])
    const shape = inputShape as tf.Shape
    const shapes = inputShape as [tf.Shape, tf.Shape, tf.Shape | null]
    return super.computeOutputShape(isSingleShape ? [shape, shape, null] : shapes)
  }

  protected computeAttention(
    query: tf.Tensor, // [B, T, N, H]
    key: tf.Tensor, // [B, S, N, H]
    value: tf.Tensor, // [B, S, N, H]
    attentionMask?: tf.Tensor,
    training?: boolean,
  ): [tf.Tensor, tf.Tensor] {
    // tfjs implements einsum as broadcast multiply + sum, which materializes [B, N, T, S, H] and is
    // very slow for longer sequences. Use batched matMul for the common case of one attention axis.
    const isSequenceAttention = query.rank === 4 && this.attentionAxes.join() === "1"
    if (!isSequenceAttention) {
      return super.computeAttention(query, key, value, attentionMask, training)
    }
    return tf.tidy(() => {
      const q = toHeadsFirst(query.mul(1 / Math.sqrt(this.keyDim)))
      const rawScores = tf.matMul(q, toHeadsFirst(key), false, true) // [B, N, T, S]
      const scores = this.maskedSoftmax(rawScores, attentionMask) // [B, N, T, S]
      const dropped = this.dropoutLayer.apply(scores, { training }) as tf.Tensor
      const output = toHeadsFirst(tf.matMul(dropped, toHeadsFirst(value))) // [B, T, N, H]
      return [output, scores]
    })
  }

  // undefined if not built yet or a projection is computed with einsum (see replaceEinsumWithMatMul)
  getProjections() {
    if (!this.builtFromSignature) return
    const denses = [this.queryDense, this.keyDense, this.valueDense, this.outputDense]
    const projections = denses.map((d) => (d as unknown as EinsumDenseInternals).projection)
    if (!projections.every((p) => !!p)) return
    return Object.fromEntries(PROJECTION_NAMES.map((name, i) => [name, projections[i]])) as Record<
      ProjectionName,
      Projection
    >
  }

  getAttentionScores(query: tf.Tensor, value = query, key?: tf.Tensor) {
    // returns [batch, numHeads, queryLength, keyLength]
    const { useCausalMask } = this
    return tf.tidy(() => this.callAndReturnAttentionScores(query, { value, key, useCausalMask })[1])
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

    // 3. Compute the projections with matMul instead of einsum (see computeAttention)
    for (const dense of [this.queryDense, this.keyDense, this.valueDense, this.outputDense]) {
      replaceEinsumWithMatMul(dense)
    }

    // 4. Register the trainable weights
    this._trainableWeights.push(...this.queryDense.trainableWeights)
    this._trainableWeights.push(...this.keyDense.trainableWeights)
    this._trainableWeights.push(...this.valueDense.trainableWeights)
    this._trainableWeights.push(...this.outputDense.trainableWeights)
  }
}

// fields of tfjs' EinsumDense that are private in its typings
type EinsumDenseInternals = {
  equation: string
  activation?: { apply: (x: tf.Tensor) => tf.Tensor }
  kernel: { read: () => tf.Tensor }
  bias?: { read: () => tf.Tensor } | null
  call: (inputs: tf.Tensor | tf.Tensor[]) => tf.Tensor
  projection?: Projection // set by replaceEinsumWithMatMul
}

export const PROJECTION_NAMES = ["query", "key", "value", "output"] as const
export type ProjectionName = (typeof PROJECTION_NAMES)[number]

// a projection computed as a single matMul [n, inDim] x [inDim, outDim] (see replaceEinsumWithMatMul),
// delta: added to the matMul result before the bias, e.g. a low-rank update of the kernel (LoRA, see model/lora)
export interface Projection {
  readonly inDim: number
  readonly outDim: number
  delta?: ProjectionDelta
}
export type ProjectionDelta = (x: tf.Tensor2D) => tf.Tensor2D // [n, inDim] -> [n, outDim]

/**
 * The projections ("abc,cde->abde" for query/key/value, "abcd,cde->abe" for the output) contract
 * the last input dims with the first kernel dims, which is a single matMul after reshaping.
 * Other equations keep using einsum.
 */
function replaceEinsumWithMatMul(dense: EinsumDense) {
  const layer = dense as unknown as EinsumDenseInternals
  const [operands, output] = layer.equation.split("->")
  const [x, kernel] = operands.split(",")
  const contracted = [...x].filter((c) => kernel.includes(c) && !output.includes(c)).join("")
  const free = x.slice(0, x.length - contracted.length)
  const isMatMul =
    contracted.length > 0 &&
    x.endsWith(contracted) &&
    kernel.startsWith(contracted) &&
    output === free + kernel.slice(contracted.length)
  if (!isMatMul) return

  const kernelShape = layer.kernel.read().shape
  const inDim = prod(kernelShape.slice(0, contracted.length))
  const outDim = prod(kernelShape.slice(contracted.length))
  const projection: Projection = { inDim, outDim }
  layer.projection = projection

  layer.call = (inputs: tf.Tensor | tf.Tensor[]) =>
    tf.tidy(() => {
      const [input] = toList(inputs)
      const k = layer.kernel.read()
      const freeShape = input.shape.slice(0, free.length)
      const flatInput = input.reshape([-1, inDim]) as tf.Tensor2D
      let flat = tf.matMul(flatInput, k.reshape([inDim, outDim]))
      if (projection.delta) flat = flat.add(projection.delta(flatInput))
      let ret = flat.reshape([...freeShape, ...k.shape.slice(contracted.length)])
      if (layer.bias) ret = ret.add(layer.bias.read())
      if (layer.activation) ret = layer.activation.apply(ret)
      return ret
    })
}

// query, key, value and output projections of a MultiHeadAttention layer
export function getProjections(layer: Layer) {
  return layer instanceof Keras3MultiHeadAttentionLayer ? layer.getProjections() : undefined
}

// each neuron is connected to all neurons at the positions (e.g. tokens) it can attend to:
// with a causal mask these are the positions up to its own, otherwise the whole previous layer
export const getAttentionInputRange: GetInputRangeFunc = (l, nIdx, prevLayer) => {
  const outputShape = l.outputShape as number[]
  const prevShape = prevLayer.outputShape as number[]
  const prevUnits = getUnits(prevLayer)
  const { isCausal } = l as { isCausal?: boolean }
  const isSequence = outputShape.length === 3 && prevShape.length === 3
  if (!isCausal || !isSequence) return { start: 0, length: prevUnits }
  const position = Math.floor(nIdx / outputShape[2])
  const numPositions = Math.min(position + 1, prevShape[1])
  return { start: 0, length: numPositions * prevShape[2] }
}

export const MultiHeadAttention: LayerDef<"MultiHeadAttention"> = {
  // @ts-expect-error with computeOutputShape
  constructorFunc: (config) => new Keras3MultiHeadAttentionLayer(config),
  defaultConfig: {
    numHeads: 1,
    keyDim: 32,
  },
  isUserAddable: false,
  getInputRange: getAttentionInputRange,
  hasRegionInputsOnly: true, // TODO: connections to the attended positions (attention scores)
}

tf.serialization.registerClass(Keras3MultiHeadAttentionLayer)
