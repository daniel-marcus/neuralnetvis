import { describe, it, expect } from "vitest"
import * as tf from "@tensorflow/tfjs"
// ESM files instead of the CJS bundle, see multi-head-attention.test.ts
import { input, model as createModel } from "@tensorflow/tfjs-layers/dist/exports"
import { add, dense, globalAveragePooling1d } from "@tensorflow/tfjs-layers/dist/exports_layers"
import type { SymbolicTensor } from "@tensorflow/tfjs-layers/dist/engine/topology"
import type { LayersModel } from "@tensorflow/tfjs-layers"
import { MultiHeadAttention } from "@/model/layers/multi-head-attention"
import { parseSafetensors } from "@/model/safetensors"
import { makeSafetensors } from "@/model/safetensors/test-utils"
import { attachLora, type LoraConfig } from "./adapter"
import { exportPeft, importPeft, type PeftLoraConfig } from "./peft"

const seqLen = 6
const dim = 8 // = numHeads * keyDim (as GPT-2)
const numBlocks = 2
const rank = 2

const maxDiff = (a: tf.Tensor, b: tf.Tensor) => a.sub(b).abs().max().dataSync()[0]

// numBlocks x (self-attention + residual)
function createModel_() {
  const inp = input({ shape: [seqLen, dim] })
  let x = dense({ units: dim }).apply(inp) as SymbolicTensor
  for (let i = 0; i < numBlocks; i++) {
    const attn = MultiHeadAttention.constructorFunc({ numHeads: 2, keyDim: 4 }).apply([
      x,
      x,
    ]) as SymbolicTensor
    x = add().apply([x, attn]) as SymbolicTensor
  }
  const pooled = globalAveragePooling1d().apply(x) as SymbolicTensor
  const out = dense({ units: 3 }).apply(pooled) as SymbolicTensor
  return createModel({ inputs: inp, outputs: out }) as unknown as LayersModel
}

const xs = tf.randomNormal([2, seqLen, dim])
const predict = (model: LayersModel) => model.predict(xs) as tf.Tensor

function randomAdapter(model: LayersModel, config: Partial<LoraConfig> = {}) {
  const adapter = attachLora(model, { rank, alpha: 4, targets: ["qkv", "output"], ...config })
  for (const v of adapter.vars) v.assign(tf.randomNormal(v.shape))
  return adapter
}

const peftConfig = (config: Partial<PeftLoraConfig> = {}): PeftLoraConfig => ({
  peft_type: "LORA",
  r: rank,
  lora_alpha: 4,
  ...config,
})

// as saved by PEFT: lora_A [rank, in], lora_B [out, rank]
function peftTensors(
  modules: string[],
  blocks = numBlocks,
  prefix = "base_model.model.transformer.",
) {
  const tensors: Record<string, { shape: number[]; data: Float32Array }> = {}
  for (let i = 0; i < blocks; i++) {
    for (const moduleName of modules) {
      const out = moduleName === "c_attn" ? 3 * dim : dim
      const name = `${prefix}h.${i}.attn.${moduleName}`
      tensors[`${name}.lora_A.weight`] = { shape: [rank, dim], data: randomData(rank * dim) }
      tensors[`${name}.lora_B.weight`] = { shape: [out, rank], data: randomData(out * rank) }
    }
  }
  return tensors
}
const randomData = (n: number) => Float32Array.from({ length: n }, () => Math.random() - 0.5)

// the projections are free again (no adapter left on the model)
function expectNoAdapter(model: LayersModel) {
  attachLora(model).detach()
}

describe("PEFT adapters", () => {
  it("exports the PEFT layout (transposed, fused c_attn)", async () => {
    const model = createModel_()
    const adapter = randomAdapter(model)
    const { weights, config } = await exportPeft(adapter, "openai-community/gpt2")
    expect(config).toMatchObject({
      peft_type: "LORA",
      task_type: "CAUSAL_LM",
      base_model_name_or_path: "openai-community/gpt2",
      r: rank,
      lora_alpha: 4,
      target_modules: ["c_attn", "attn.c_proj"],
      fan_in_fan_out: true,
    })
    const tensors = parseSafetensors(weights)
    const p = "base_model.model.transformer.h.1.attn."
    expect(Object.keys(tensors)).toHaveLength(numBlocks * 4)
    expect(tensors[p + "c_attn.lora_A.weight"].shape).toEqual([rank, dim])
    expect(tensors[p + "c_attn.lora_B.weight"].shape).toEqual([3 * dim, rank])
    expect(tensors[p + "c_proj.lora_B.weight"].shape).toEqual([dim, rank])

    // rows dim..2*dim of the fused B = B_key^T
    const layerName = adapter.layerNames[1]
    const bKey = adapter.weights.get(`${layerName}/qkv/B_key`)!.transpose().dataSync()
    const fused = tensors[p + "c_attn.lora_B.weight"].data
    expect(Array.from(fused.subarray(dim * rank, 2 * dim * rank))).toEqual(Array.from(bKey))
    adapter.detach()
  })

  it.each<LoraConfig["targets"]>([["qkv"], ["qkv", "output"], ["output"]])(
    "imports exported adapters with the same outputs (%j)",
    async (...targets) => {
      const model = createModel_()
      const adapter = randomAdapter(model, { targets })
      const expected = predict(model)
      const { weights, config } = await exportPeft(adapter)
      adapter.detach()

      const imported = importPeft(model, weights, config)
      expect(imported.config).toEqual(adapter.config)
      expect(maxDiff(predict(model), expected)).toBeLessThan(1e-5)
      imported.detach()
    },
  )

  it("can't export separate query, key, value targets", async () => {
    const model = createModel_()
    const adapter = attachLora(model, { rank, alpha: 4, targets: ["query", "value"] })
    await expect(exportPeft(adapter)).rejects.toThrow("no PEFT module for query, value")
    adapter.detach()
  })

  it("imports adapters of GPT2Model (without transformer. prefix) and rsLoRA", () => {
    const model = createModel_()
    const buffer = makeSafetensors(peftTensors(["c_attn"], numBlocks, "base_model.model."))
    const adapter = importPeft(model, buffer, peftConfig({ use_rslora: true }))
    expect(adapter.config).toEqual({ rank, alpha: 4 * Math.sqrt(rank), targets: ["qkv"] })
    adapter.detach()
  })

  it.each([
    ["other modules", peftTensors(["c_attn", "c_fc"]), {}, "unsupported module c_fc"],
    ["other tensors", { "lm_head.weight": { shape: [1], data: [1] } }, {}, "unsupported tensor"],
    ["missing blocks", peftTensors(["c_attn"], 1), {}, "missing"],
    ["more blocks", peftTensors(["c_attn"], 3), {}, "more blocks than the model"],
    ["another rank", peftTensors(["c_proj"]), { r: 4 }, "has shape [8,2], expected [8,4]"],
    ["DoRA", peftTensors(["c_attn"]), { use_dora: true }, "DoRA"],
    ["rank_pattern", peftTensors(["c_attn"]), { rank_pattern: { c_proj: 4 } }, "per module"],
  ])("rejects %s and leaves no adapter", (_, tensors, config, error) => {
    const model = createModel_()
    expect(() => importPeft(model, makeSafetensors(tensors), peftConfig(config))).toThrow(error)
    expectNoAdapter(model)
  })

  it("only imports into a model without active adapter", async () => {
    const model = createModel_()
    const adapter = randomAdapter(model)
    const { weights, config } = await exportPeft(adapter)
    expect(() => importPeft(model, weights, config)).toThrow("already has an adapter")
    adapter.setEnabled(false)
    const imported = importPeft(model, weights, config)
    expect(() => adapter.setEnabled(true)).toThrow("another adapter")
    imported.detach()
    adapter.detach()
  })
})
