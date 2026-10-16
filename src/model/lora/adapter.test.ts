import { describe, it, expect } from "vitest"
import * as tf from "@tensorflow/tfjs"
// ESM files instead of the CJS bundle, see multi-head-attention.test.ts
import { input, model as createModel } from "@tensorflow/tfjs-layers/dist/exports"
import { add, dense, globalAveragePooling1d } from "@tensorflow/tfjs-layers/dist/exports_layers"
import type { Layer, SymbolicTensor } from "@tensorflow/tfjs-layers/dist/engine/topology"
import type { LayersModel } from "@tensorflow/tfjs-layers"
import { MultiHeadAttention } from "@/model/layers/multi-head-attention"
import { attachLora, type LoraAdapter, type LoraConfig } from "./adapter"

const seqLen = 6
const dim = 8
const numHeads = 2
const keyDim = 4
const numBlocks = 2

const maxDiff = (a: tf.Tensor, b: tf.Tensor) => a.sub(b).abs().max().dataSync()[0]

type AttentionLayer = Layer &
  Record<"queryDense" | "keyDense" | "valueDense" | "outputDense", Layer>

// numBlocks x (self-attention + residual)
function createModel_() {
  const inp = input({ shape: [seqLen, dim] })
  let x = dense({ units: dim }).apply(inp) as SymbolicTensor
  const mhas: AttentionLayer[] = []
  for (let i = 0; i < numBlocks; i++) {
    const mha = MultiHeadAttention.constructorFunc({ numHeads, keyDim }) as AttentionLayer
    const attn = mha.apply([x, x]) as SymbolicTensor
    x = add().apply([x, attn]) as SymbolicTensor
    mhas.push(mha)
  }
  const pooled = globalAveragePooling1d().apply(x) as SymbolicTensor
  const out = dense({ units: 3 }).apply(pooled) as SymbolicTensor
  return { model: createModel({ inputs: inp, outputs: out }) as unknown as LayersModel, mhas }
}

const xs = tf.randomNormal([2, seqLen, dim])
const predict = (model: LayersModel) => model.predict(xs) as tf.Tensor

// B of the adapter is initialized with zeros: random values to see an effect
function randomizeB(adapter: LoraAdapter) {
  for (const [key, v] of adapter.weights) if (/\/B/.test(key)) v.assign(tf.randomNormal(v.shape))
}

describe("LoRA adapter", () => {
  it("creates A and B per target (qkv: shared A)", () => {
    const { model, mhas } = createModel_()
    const adapter = attachLora(model, { rank: 2, alpha: 4, targets: ["qkv", "output"] })
    const [name] = mhas.map((l) => l.name)
    const shapes = Object.fromEntries([...adapter.weights].map(([k, v]) => [k, v.shape]))
    expect(shapes).toMatchObject({
      [`${name}/qkv/A`]: [dim, 2],
      [`${name}/qkv/B_query`]: [2, numHeads * keyDim],
      [`${name}/qkv/B_key`]: [2, numHeads * keyDim],
      [`${name}/qkv/B_value`]: [2, numHeads * keyDim],
      [`${name}/output/A`]: [numHeads * keyDim, 2],
      [`${name}/output/B`]: [2, dim],
    })
    expect(adapter.weights.size).toBe(numBlocks * 6)
    expect(adapter.vars.every((v) => v.trainable)).toBe(true)
    adapter.detach()
  })

  it("starts as the base model", () => {
    const { model } = createModel_()
    const base = predict(model).arraySync()
    const adapter = attachLora(model)
    expect(predict(model).arraySync()).toEqual(base)
    adapter.detach()
  })

  it("can be disabled and detached", () => {
    const { model } = createModel_()
    const base = predict(model)
    const adapter = attachLora(model)
    randomizeB(adapter)
    expect(maxDiff(predict(model), base)).toBeGreaterThan(1e-3)
    adapter.setEnabled(false)
    expect(maxDiff(predict(model), base)).toBe(0)
    adapter.setEnabled(true)
    expect(maxDiff(predict(model), base)).toBeGreaterThan(1e-3)
    const vars = adapter.vars
    adapter.detach()
    expect(maxDiff(predict(model), base)).toBe(0)
    expect(vars.every((v) => v.isDisposed)).toBe(true)
    expect(() => adapter.setEnabled(true)).toThrow()
  })

  // y = x (W + A B * alpha / rank): same outputs as with the merged kernels
  it.each<LoraConfig["targets"]>([
    ["qkv", "output"],
    ["query", "value"],
  ])("equals the merged kernels (%j)", (...targets) => {
    const { model, mhas } = createModel_()
    const config = { rank: 2, alpha: 3, targets }
    const adapter = attachLora(model, config)
    randomizeB(adapter)
    const withAdapter = predict(model)
    adapter.setEnabled(false)
    const get = (key: string) => adapter.weights.get(key)!
    for (const mha of mhas) {
      for (const name of ["query", "key", "value", "output"] as const) {
        const [A, B] =
          targets.includes("qkv") && name !== "output"
            ? [get(`${mha.name}/qkv/A`), get(`${mha.name}/qkv/B_${name}`)]
            : targets.includes(name)
              ? [get(`${mha.name}/${name}/A`), get(`${mha.name}/${name}/B`)]
              : []
        if (!A || !B) continue
        const kernel = mha[`${name}Dense`].getWeights()[0]
        const update = A.matMul(B)
          .mul(config.alpha / config.rank)
          .reshape(kernel.shape)
        const [, bias] = mha[`${name}Dense`].getWeights()
        mha[`${name}Dense`].setWeights([kernel.add(update), bias])
      }
    }
    expect(maxDiff(predict(model), withAdapter)).toBeLessThan(1e-5)
    adapter.detach()
  })

  it("trains only its weights (B gets gradients first, A once B is not zero)", () => {
    const { model } = createModel_()
    const baseWeights = model.getWeights().map((w) => w.clone())
    const adapter = attachLora(model)
    const target = tf.randomNormal([2, 3])
    const loss = () => predict(model).sub(target).square().mean() as tf.Scalar
    const norms = () => {
      const { grads } = tf.variableGrads(loss, adapter.vars)
      return Object.fromEntries(
        [...adapter.weights].map(([k, v]) => [k, grads[v.name].norm().dataSync()[0]]),
      )
    }
    for (const [key, norm] of Object.entries(norms())) {
      if (key.endsWith("/A")) expect(norm).toBe(0)
      else expect(norm).toBeGreaterThan(0)
    }
    const optimizer = tf.train.adam(0.01)
    for (let i = 0; i < 5; i++) optimizer.minimize(loss, false, adapter.vars)
    for (const norm of Object.values(norms())) expect(norm).toBeGreaterThan(0)
    // the base weights are unchanged
    for (const [i, w] of model.getWeights().entries()) expect(maxDiff(w, baseWeights[i])).toBe(0)
    optimizer.dispose()
    adapter.detach()
  })

  it("throws for invalid targets, a 2nd adapter and models without attention", () => {
    const { model } = createModel_()
    expect(() => attachLora(model, { rank: 2, alpha: 2, targets: ["qkv", "query"] })).toThrow()
    const adapter = attachLora(model)
    expect(() => attachLora(model)).toThrow("already has an adapter")
    adapter.setEnabled(false)
    const other = attachLora(model)
    expect(() => adapter.setEnabled(true)).toThrow("another adapter")
    other.detach()
    adapter.setEnabled(true)
    adapter.detach()

    const inp = input({ shape: [dim] })
    const noAttention = createModel({
      inputs: inp,
      outputs: dense({ units: 2 }).apply(inp) as SymbolicTensor,
    })
    expect(() => attachLora(noAttention as unknown as LayersModel)).toThrow("no MultiHeadAttention")
  })
})
