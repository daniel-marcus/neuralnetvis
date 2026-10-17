import { describe, expect, it } from "vitest"
import { getWeightsFromSafetensors } from "."
import { transposeRows } from "./lfm2"
import { makeSafetensors } from "./test-utils"
import type * as tf from "@tensorflow/tfjs"

// tiny LFM2: block 0 short convolution, block 1 attention (2 query heads, 1 key/value head, headDim 2),
// hidden 4, ffDim 6, vocab 5, kernel size 3
const [d, ff, vocab, k, numHeads, numKvHeads, headDim] = [4, 6, 5, 3, 2, 1, 2]

let counter = 0
const tensor = (...shape: number[]) => {
  const size = shape.reduce((a, b) => a * b, 1)
  // integers < 256: exact in BF16 (8 bits mantissa), unique within each tensor
  return { shape, data: Array.from({ length: size }, () => counter++ % 256), dtype: "BF16" }
}

function makeCheckpoint(): Record<string, ReturnType<typeof tensor>> {
  counter = 0
  const mlp = (p: string) => ({
    [p + "ffn_norm.weight"]: tensor(d),
    [p + "feed_forward.w1.weight"]: tensor(ff, d),
    [p + "feed_forward.w3.weight"]: tensor(ff, d),
    [p + "feed_forward.w2.weight"]: tensor(d, ff),
  })
  return {
    "model.embed_tokens.weight": tensor(vocab, d),
    "model.layers.0.operator_norm.weight": tensor(d),
    "model.layers.0.conv.in_proj.weight": tensor(3 * d, d),
    "model.layers.0.conv.conv.weight": tensor(d, 1, k),
    "model.layers.0.conv.out_proj.weight": tensor(d, d),
    ...mlp("model.layers.0."),
    "model.layers.1.operator_norm.weight": tensor(d),
    "model.layers.1.self_attn.q_proj.weight": tensor(numHeads * headDim, d),
    "model.layers.1.self_attn.k_proj.weight": tensor(numKvHeads * headDim, d),
    "model.layers.1.self_attn.v_proj.weight": tensor(numKvHeads * headDim, d),
    "model.layers.1.self_attn.out_proj.weight": tensor(d, numHeads * headDim),
    "model.layers.1.self_attn.q_layernorm.weight": tensor(headDim),
    "model.layers.1.self_attn.k_layernorm.weight": tensor(headDim),
    ...mlp("model.layers.1."),
    "model.embedding_norm.weight": tensor(d),
  }
}

const spec = (name: string, shape: number[]) => ({ name, shape, dtype: "float32" as const })

// as in model.json of ml-notebooks/lfm2.py (Keras order: not the order of the checkpoint)
function makeWeightSpecs(): tf.io.WeightsManifestEntry[] {
  const mlp = (b: string) => [
    spec(`${b}ffn_norm/scale`, [d]),
    spec(`${b}ffn_gate/kernel`, [d, ff]),
    spec(`${b}ffn_up/kernel`, [d, ff]),
    spec(`${b}ffn_down/kernel`, [ff, d]),
  ]
  return [
    spec("token_embedding/embeddings", [vocab, d]),
    spec("block_0_operator_norm/scale", [d]),
    spec("block_0_conv_b/kernel", [d, d]),
    spec("block_0_conv_x/kernel", [d, d]),
    spec("block_0_conv_c/kernel", [d, d]),
    spec("block_0_conv/depthwise_kernel", [k, d, 1]),
    spec("block_0_conv_out/kernel", [d, d]),
    ...mlp("block_0_"),
    spec("block_1_operator_norm/scale", [d]),
    spec("block_1_attention/query/kernel", [d, numHeads, headDim]),
    spec("block_1_attention/key/kernel", [d, numKvHeads, headDim]),
    spec("block_1_attention/value/kernel", [d, numKvHeads, headDim]),
    spec("block_1_attention/attention_output/kernel", [numHeads, headDim, d]),
    spec("block_1_attention/query_norm/scale", [headDim]),
    spec("block_1_attention/key_norm/scale", [headDim]),
    ...mlp("block_1_"),
    spec("final_norm/scale", [d]),
  ]
}

// [rows, cols] -> [cols, rows]
const transpose = (data: number[], rows: number) => {
  const cols = data.length / rows
  return Array.from(
    { length: cols * rows },
    (_, i) => data[(i % rows) * cols + Math.floor(i / rows)],
  )
}

describe("transposeRows", () => {
  it("should transpose a range of rows", () => {
    const data = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]) // [4, 2]
    expect(Array.from(transposeRows(data, 2, 0, 4))).toEqual([1, 3, 5, 7, 2, 4, 6, 8])
    expect(Array.from(transposeRows(data, 2, 1, 2))).toEqual([3, 5, 4, 6])
  })
})

describe("mapLfm2", () => {
  const checkpoint = makeCheckpoint()
  const specs = makeWeightSpecs()
  const buffers = getWeightsFromSafetensors(makeSafetensors(checkpoint, 1), specs, "lfm2")
  const byName = Object.fromEntries(
    specs.map((s, i) => [s.name, Array.from(new Float32Array(buffers[i]))]),
  )
  const get = (name: string) => checkpoint[name].data

  it("should keep the embeddings and norms (final norm: embedding_norm)", () => {
    expect(byName["token_embedding/embeddings"]).toEqual(get("model.embed_tokens.weight"))
    expect(byName["block_1_ffn_norm/scale"]).toEqual(get("model.layers.1.ffn_norm.weight"))
    expect(byName["block_1_attention/key_norm/scale"]).toEqual(
      get("model.layers.1.self_attn.k_layernorm.weight"),
    )
    expect(byName["final_norm/scale"]).toEqual(get("model.embedding_norm.weight"))
  })

  it("should split in_proj into B, C and x, transposed", () => {
    const inProj = get("model.layers.0.conv.in_proj.weight") // [3 * d, d]
    for (const [j, part] of ["b", "c", "x"].entries()) {
      const rows = inProj.slice(j * d * d, (j + 1) * d * d)
      expect(byName[`block_0_conv_${part}/kernel`], part).toEqual(transpose(rows, d))
    }
  })

  it("should transpose the conv kernel to [kernelSize, channels, 1]", () => {
    const conv = get("model.layers.0.conv.conv.weight") // [d, 1, k]
    expect(byName["block_0_conv/depthwise_kernel"]).toEqual(transpose(conv, d))
  })

  it("should transpose the Linear weights (attention, MLP)", () => {
    const cases = {
      "block_1_attention/query/kernel": "model.layers.1.self_attn.q_proj.weight",
      "block_1_attention/attention_output/kernel": "model.layers.1.self_attn.out_proj.weight",
      "block_0_conv_out/kernel": "model.layers.0.conv.out_proj.weight",
      "block_0_ffn_gate/kernel": "model.layers.0.feed_forward.w1.weight",
      "block_0_ffn_up/kernel": "model.layers.0.feed_forward.w3.weight",
      "block_0_ffn_down/kernel": "model.layers.0.feed_forward.w2.weight",
    }
    for (const [specName, tensorName] of Object.entries(cases)) {
      const { shape, data } = checkpoint[tensorName]
      expect(byName[specName], specName).toEqual(transpose(data, shape[0]))
    }
  })

  it("should throw for unknown weights", () => {
    const buffer = makeSafetensors(checkpoint)
    const unknown = [...specs, spec("block_0_unknown/kernel", [d])]
    expect(() => getWeightsFromSafetensors(buffer, unknown, "lfm2")).toThrow("unknown weight")
  })
})
