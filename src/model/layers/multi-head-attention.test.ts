import { describe, it, expect, vi } from "vitest"
import * as tf from "@tensorflow/tfjs"
// Under Node, @tensorflow/tfjs resolves to the CJS bundle, which has its own copy of the tfjs-layers
// classes. Build the models from the ESM files instead (as the browser bundle does), so that they
// share SymbolicTensor/Layer with the MultiHeadAttention subclass.
import { input, model as createModel, loadLayersModel } from "@tensorflow/tfjs-layers/dist/exports"
import { add, dense, globalAveragePooling1d } from "@tensorflow/tfjs-layers/dist/exports_layers"
import type { Layer, SymbolicTensor } from "@tensorflow/tfjs-layers/dist/engine/topology"
import type { LayersModel } from "@tensorflow/tfjs-layers/dist/engine/training"
import { MultiHeadAttention as TfjsMultiHeadAttention } from "@tensorflow/tfjs-layers/dist/layers/nlp/multihead_attention"
import { EinsumDense } from "@tensorflow/tfjs-layers/dist/layers/nlp/einsum_dense"
import { MultiHeadAttention } from "./multi-head-attention"

const seqLen = 6
const dim = 8
const numHeads = 2
const keyDim = 4

const maxDiff = (a: tf.Tensor, b: tf.Tensor) => a.sub(b).abs().max().dataSync()[0]

type ComputeAttention = (
  query: tf.Tensor,
  key: tf.Tensor,
  value: tf.Tensor,
  attentionMask?: tf.Tensor,
) => [tf.Tensor, tf.Tensor]

type AttentionLayer = Layer & {
  getAttentionScores: (query: tf.Tensor) => tf.Tensor
  computeAttention: ComputeAttention
  queryDense: Layer
  keyDense: Layer
  valueDense: Layer
  outputDense: Layer
}

function createSelfAttentionModel() {
  const inp = input({ shape: [seqLen, dim] })
  const x = dense({ units: dim }).apply(inp) as SymbolicTensor
  const mha = MultiHeadAttention.constructorFunc({ numHeads, keyDim }) as AttentionLayer
  const attn = mha.apply([x, x]) as SymbolicTensor // as in Keras: mha(x, x)
  const res = add().apply([x, attn]) as SymbolicTensor // x is used again after the attention layer
  const pooled = globalAveragePooling1d().apply(res) as SymbolicTensor
  const out = dense({ units: 2, activation: "softmax" }).apply(pooled) as SymbolicTensor
  return { model: createModel({ inputs: inp, outputs: out }), mha, mhaInput: x }
}

async function getArtifacts(model: LayersModel) {
  let artifacts: tf.io.ModelArtifacts | undefined
  await model.save(
    tf.io.withSaveHandler(async (a) => {
      artifacts = a
      return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: "JSON" } }
    }),
  )
  return artifacts!
}

describe("MultiHeadAttention (self-attention)", () => {
  const xs = tf.randomNormal([3, seqLen, dim])
  const ys = tf.oneHot(tf.tensor1d([0, 1, 0], "int32"), 2)

  it("uses a single graph input for [x, x]", () => {
    const { mha } = createSelfAttentionModel()
    expect(mha.inboundNodes[0].inboundLayers).toHaveLength(1)
  })

  it("works with predict and evaluate", () => {
    const { model } = createSelfAttentionModel()
    model.compile({ optimizer: "sgd", loss: "categoricalCrossentropy" })
    const pred = model.predict(xs) as tf.Tensor
    expect(pred.shape).toEqual([3, 2])
    const loss = model.evaluate(xs, ys) as tf.Scalar
    expect(Number.isFinite(loss.dataSync()[0])).toBe(true)
  })

  it("loads models exported from Keras with [x, x] inputs", async () => {
    const { model } = createSelfAttentionModel()
    const artifacts = await getArtifacts(model)
    const topology = artifacts.modelTopology as { config: { layers: KerasLayerJson[] } }
    const mhaJson = topology.config.layers.find((l) => l.class_name === "MultiHeadAttention")!
    const [x] = mhaJson.inbound_nodes[0]
    mhaJson.inbound_nodes = [[x, x]]

    const warn = vi.spyOn(console, "warn")
    const loaded = await loadLayersModel(tf.io.fromMemory(artifacts))
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("non-serializable"))
    warn.mockRestore()

    const expected = (model.predict(xs) as tf.Tensor).arraySync()
    expect((loaded.predict(xs) as tf.Tensor).arraySync()).toEqual(expected)
  })

  it("applies the causal mask from the call kwargs of models exported from Keras", async () => {
    // Keras: mha(x, x, use_causal_mask=True), see parseModelObject in import-keras.ts
    const inp = input({ shape: [seqLen, dim] })
    const mha = MultiHeadAttention.constructorFunc({ numHeads, keyDim }) as AttentionLayer
    const model = createModel({ inputs: inp, outputs: mha.apply([inp, inp]) as SymbolicTensor })
    const artifacts = await getArtifacts(model)
    const topology = artifacts.modelTopology as { config: { layers: KerasLayerJson[] } }
    const mhaJson = topology.config.layers.find((l) => l.class_name === "MultiHeadAttention")!
    const [x] = mhaJson.inbound_nodes[0] as [string, number, number, object]
    const xWithKwargs = [x[0], x[1], x[2], { use_causal_mask: true }] // tfjs: snake_case in model.json
    mhaJson.inbound_nodes = [[xWithKwargs, xWithKwargs]]
    const loaded = await loadLayersModel(tf.io.fromMemory(artifacts))

    // changing the last position must not change the outputs of the earlier positions
    const xs1 = tf.randomNormal([1, seqLen, dim])
    const xs2 = tf.concat([xs1.slice([0, 0, 0], [1, seqLen - 1, dim]), tf.ones([1, 1, dim])], 1)
    const [out1, out2] = [xs1, xs2].map((batch) => loaded.predict(batch) as tf.Tensor)
    const earlier = (t: tf.Tensor) => t.slice([0, 0, 0], [1, seqLen - 1, dim])
    expect(maxDiff(earlier(out1), earlier(out2))).toBeLessThan(1e-6)
    expect(maxDiff(out1, out2)).toBeGreaterThan(1e-3)

    // attention scores above the diagonal (attending to future positions) are zero
    const loadedMha = loaded.layers.find((l) => l.getClassName() === mha.getClassName())
    const scores = (loadedMha as AttentionLayer).getAttentionScores(xs1)
    const future = tf.sub(1, tf.linalg.bandPart(tf.ones([seqLen, seqLen]), -1, 0))
    expect(scores.mul(future).abs().max().dataSync()[0]).toBe(0)

    // and saving the model keeps it
    const resaved = (await getArtifacts(loaded)).modelTopology as typeof topology
    const resavedMha = resaved.config.layers.find((l) => l.class_name === "MultiHeadAttention")!
    expect(resavedMha.inbound_nodes[0][0]).toEqual(xWithKwargs)
  })

  it("returns attention scores equal to softmax(QK^T / sqrt(keyDim))", () => {
    const { model, mha, mhaInput } = createSelfAttentionModel()
    const x = createModel({ inputs: model.inputs, outputs: mhaInput }).predict(xs) as tf.Tensor
    const scores = mha.getAttentionScores(x)
    expect(scores.shape).toEqual([3, numHeads, seqLen, seqLen])

    const expected = tf.tidy(() => {
      const q = (mha.queryDense.apply(x) as tf.Tensor).transpose([0, 2, 1, 3]) // [b, heads, seq, keyDim]
      const k = (mha.keyDense.apply(x) as tf.Tensor).transpose([0, 2, 1, 3])
      return tf.softmax(tf.matMul(q, k, false, true).div(Math.sqrt(keyDim)))
    })
    expect(maxDiff(scores, expected)).toBeLessThan(1e-6)
  })
})

describe("MultiHeadAttention.computeAttention", () => {
  // the matMul implementation must match tfjs' einsum-based implementation
  const { mha } = createSelfAttentionModel()
  const einsumComputeAttention = (TfjsMultiHeadAttention.prototype as unknown as AttentionLayer)
    .computeAttention
  const batchSize = 2
  const [q, k, v] = [0, 1, 2].map(() => tf.randomNormal([batchSize, seqLen, numHeads, keyDim]))
  const causalMask = tf.linalg
    .bandPart(tf.ones([seqLen, seqLen]), -1, 0)
    .expandDims(0)
    .tile([batchSize, 1, 1])

  it.each([
    ["without mask", undefined],
    ["with causal mask", causalMask],
  ])("matches the einsum implementation %s", (_, mask) => {
    const [output, scores] = mha.computeAttention(q, k, v, mask)
    const [refOutput, refScores] = einsumComputeAttention.call(mha, q, k, v, mask)
    expect(output.shape).toEqual(refOutput.shape)
    expect(scores.shape).toEqual(refScores.shape)
    expect(maxDiff(output, refOutput)).toBeLessThan(1e-5)
    expect(maxDiff(scores, refScores)).toBeLessThan(1e-5)
  })
})

const einsumCall = (layer: Layer, x: tf.Tensor) =>
  (EinsumDense.prototype.call as (x: tf.Tensor) => tf.Tensor).call(layer, x)

describe("MultiHeadAttention projections", () => {
  const { model, mha } = createSelfAttentionModel()
  it("compute the same as tfjs' EinsumDense", () => {
    const x = tf.randomNormal([2, seqLen, dim]) // input of query/key/value projections
    const h = tf.randomNormal([2, seqLen, numHeads, keyDim]) // input of output projection
    const cases: [Layer, tf.Tensor][] = [
      [mha.queryDense, x],
      [mha.keyDense, x],
      [mha.valueDense, x],
      [mha.outputDense, h],
    ]
    for (const [layer, layerInput] of cases) {
      layer.setWeights(layer.getWeights().map((w) => tf.randomNormal(w.shape))) // non-zero bias
      expect(layer.call, layer.name).not.toBe(EinsumDense.prototype.call) // uses matMul
      const output = layer.call(layerInput, {}) as tf.Tensor
      const expected = einsumCall(layer, layerInput)
      expect(output.shape, layer.name).toEqual(expected.shape)
      expect(maxDiff(output, expected), layer.name).toBeLessThan(1e-5)
    }
  })

  it("are trainable", async () => {
    model.compile({ optimizer: "adam", loss: "categoricalCrossentropy" })
    const xs = tf.randomNormal([4, seqLen, dim])
    const ys = tf.oneHot(tf.tensor1d([0, 1, 0, 1], "int32"), 2)
    const kernels = [mha.queryDense, mha.keyDense, mha.valueDense, mha.outputDense].map(
      (l) => l.getWeights()[0],
    )
    const before = kernels.map((k) => k.clone())
    const history = await model.fit(xs, ys, { epochs: 2, verbose: 0 })
    expect(history.history.loss.every((l) => Number.isFinite(l as number))).toBe(true)
    kernels.forEach((k, i) => expect(maxDiff(k, before[i]), `kernel ${i}`).toBeGreaterThan(0))
  })
})

type KerasLayerJson = {
  class_name: string
  inbound_nodes: unknown[][]
}
