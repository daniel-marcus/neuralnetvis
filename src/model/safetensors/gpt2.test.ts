import { describe, expect, it } from "vitest"
import { getWeightsFromSafetensors } from "."
import { splitColumns } from "./gpt2"
import { makeSafetensors } from "./test-utils"
import type * as tf from "@tensorflow/tfjs"

// tiny GPT-2: 2 blocks, embedDim 4, 2 heads (headDim 2), ffDim 8, vocab 5, 6 positions (model: 3)
const [numBlocks, d, numHeads, ff, vocab, positions, seqLen] = [2, 4, 2, 8, 5, 6, 3]
const headDim = d / numHeads

let counter = 0
const tensor = (...shape: number[]) => {
  const size = shape.reduce((a, b) => a * b, 1)
  return { shape, data: Array.from({ length: size }, () => counter++) }
}

function makeCheckpoint() {
  counter = 0
  const tensors: Record<string, ReturnType<typeof tensor>> = {
    "wte.weight": tensor(vocab, d),
    "wpe.weight": tensor(positions, d),
  }
  for (let i = 0; i < numBlocks; i++) {
    const p = `h.${i}.`
    Object.assign(tensors, {
      [p + "ln_1.weight"]: tensor(d),
      [p + "ln_1.bias"]: tensor(d),
      [p + "attn.bias"]: tensor(1, 1, positions, positions), // causal mask, not a weight
      [p + "attn.c_attn.weight"]: tensor(d, 3 * d),
      [p + "attn.c_attn.bias"]: tensor(3 * d),
      [p + "attn.c_proj.weight"]: tensor(d, d),
      [p + "attn.c_proj.bias"]: tensor(d),
      [p + "ln_2.weight"]: tensor(d),
      [p + "ln_2.bias"]: tensor(d),
      [p + "mlp.c_fc.weight"]: tensor(d, ff),
      [p + "mlp.c_fc.bias"]: tensor(ff),
      [p + "mlp.c_proj.weight"]: tensor(ff, d),
      [p + "mlp.c_proj.bias"]: tensor(d),
    })
  }
  Object.assign(tensors, { "ln_f.weight": tensor(d), "ln_f.bias": tensor(d) })
  return tensors
}

const spec = (name: string, shape: number[]) => ({ name, shape, dtype: "float32" as const })

// as in model.json of ml-notebooks/gpt2.py (layer names with arbitrary numbers)
function makeWeightSpecs(): tf.io.WeightsManifestEntry[] {
  const specs = [
    spec("reversible_embedding_1/embeddings", [vocab, d]),
    spec("position_embedding_1/embeddings", [seqLen, d]),
  ]
  const norm = (n: number) => [
    spec(`layer_normalization_${n}/gamma`, [d]),
    spec(`layer_normalization_${n}/beta`, [d]),
  ]
  for (let i = 0; i < numBlocks; i++) {
    const mha = `multi_head_attention_${i + 3}`
    specs.push(...norm(2 * i + 7))
    for (const name of ["query", "key", "value"]) {
      specs.push(
        spec(`${mha}/${name}_dense/kernel`, [d, numHeads, headDim]),
        spec(`${mha}/${name}_dense/bias`, [numHeads, headDim]),
      )
    }
    specs.push(
      spec(`${mha}/output_dense/kernel`, [numHeads, headDim, d]),
      spec(`${mha}/output_dense/bias`, [d]),
    )
    specs.push(...norm(2 * i + 8))
    specs.push(
      spec(`dense_${2 * i}/kernel`, [d, ff]),
      spec(`dense_${2 * i}/bias`, [ff]),
      spec(`dense_${2 * i + 1}/kernel`, [ff, d]),
      spec(`dense_${2 * i + 1}/bias`, [d]),
    )
  }
  specs.push(...norm(11))
  return specs
}

describe("splitColumns", () => {
  it("should split [rows, 3 * cols] into 3 x [rows, cols]", () => {
    const data = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) // [2, 6]
    const parts = splitColumns(data, 2, 3).map((p) => Array.from(p))
    expect(parts).toEqual([
      [1, 2, 7, 8],
      [3, 4, 9, 10],
      [5, 6, 11, 12],
    ])
  })
})

describe("mapGpt2", () => {
  const checkpoint = makeCheckpoint()
  const specs = makeWeightSpecs()
  const buffers = getWeightsFromSafetensors(makeSafetensors(checkpoint, 3), specs, "gpt2")
  const weights = buffers.map((b) => Array.from(new Float32Array(b)))
  const byName = Object.fromEntries(specs.map((s, i) => [s.name, weights[i]]))

  it("should return one buffer per weight spec with the right size", () => {
    expect(buffers).toHaveLength(specs.length)
    for (const [i, { name, shape }] of specs.entries()) {
      expect(weights[i], name).toHaveLength(shape.reduce((a, b) => a * b, 1))
    }
  })

  it("should keep the embeddings, but only the first seqLen positions", () => {
    expect(byName["reversible_embedding_1/embeddings"]).toEqual(checkpoint["wte.weight"].data)
    const wpe = checkpoint["wpe.weight"].data
    expect(byName["position_embedding_1/embeddings"]).toEqual(wpe.slice(0, seqLen * d))
  })

  it("should split c_attn into query, key and value", () => {
    const kernel = checkpoint["h.1.attn.c_attn.weight"].data // [d, 3 * d]
    const bias = checkpoint["h.1.attn.c_attn.bias"].data
    for (const [j, name] of ["query", "key", "value"].entries()) {
      const expected = Array.from({ length: d }, (_, r) =>
        kernel.slice(r * 3 * d + j * d, r * 3 * d + (j + 1) * d),
      ).flat()
      expect(byName[`multi_head_attention_4/${name}_dense/kernel`], name).toEqual(expected)
      expect(byName[`multi_head_attention_4/${name}_dense/bias`]).toEqual(
        bias.slice(j * d, (j + 1) * d),
      )
    }
  })

  it("should keep the other weights as they are (Conv1D: [in, out] like Keras)", () => {
    expect(byName["multi_head_attention_4/output_dense/kernel"]).toEqual(
      checkpoint["h.1.attn.c_proj.weight"].data,
    )
    expect(byName["dense_2/kernel"]).toEqual(checkpoint["h.1.mlp.c_fc.weight"].data)
    expect(byName["dense_3/bias"]).toEqual(checkpoint["h.1.mlp.c_proj.bias"].data)
    expect(byName["layer_normalization_11/gamma"]).toEqual(checkpoint["ln_f.weight"].data)
  })

  it("should throw if the model has a different structure", () => {
    const swapped = [specs[1], specs[0], ...specs.slice(2)]
    const buffer = makeSafetensors(checkpoint)
    expect(() => getWeightsFromSafetensors(buffer, swapped, "gpt2")).toThrow("expected")
    expect(() => getWeightsFromSafetensors(buffer, specs.slice(0, -2), "gpt2")).toThrow()
  })
})
