import type { SafeTensors, SafetensorsMapper } from "."

// GPT-2 checkpoint (https://huggingface.co/openai-community/gpt2) -> model.json of ml-notebooks/gpt2.py.
// Same mapping as load_gpt2_weights there, keep both in sync!
// - Conv1D kernels are [in, out] like Keras: no transpose
// - q, k, v in one c_attn kernel [in, 3 * embedDim] with biases
// - attention scores are scaled by 1/sqrt(headDim) like in Keras: no rescaling of q
export const mapGpt2: SafetensorsMapper = {
  // causal mask buffers, not weights
  skip: (name) => /\.attn\.(masked_)?bias$/.test(name),
  map(tensors, weightSpecs) {
    const get = (name: string) => getTensor(tensors, name).data
    const [, embedDim] = getTensor(tensors, "wte.weight").shape
    const numBlocks = Object.keys(tensors).filter((n) =>
      /^(transformer\.)?h\.\d+\.ln_1\.weight$/.test(n),
    ).length
    const posSpec = weightSpecs.find((s) => getKind(s.name) === "position_embedding/embeddings")
    const seqLen = posSpec?.shape[0] ?? 0

    // [kind of the tfjs weight, data]
    const weights: [string, Float32Array][] = [
      ["reversible_embedding/embeddings", get("wte.weight")],
      ["position_embedding/embeddings", get("wpe.weight").subarray(0, seqLen * embedDim)],
    ]
    const norm = (name: string) =>
      weights.push(
        ["layer_normalization/gamma", get(`${name}.weight`)],
        ["layer_normalization/beta", get(`${name}.bias`)],
      )
    for (let i = 0; i < numBlocks; i++) {
      const p = `h.${i}.`
      norm(p + "ln_1")
      const kernels = splitColumns(get(p + "attn.c_attn.weight"), embedDim, 3)
      const biases = splitColumns(get(p + "attn.c_attn.bias"), 1, 3)
      for (const [j, name] of ["query", "key", "value"].entries()) {
        weights.push(
          [`multi_head_attention/${name}_dense/kernel`, kernels[j]], // [in, numHeads, headDim]
          [`multi_head_attention/${name}_dense/bias`, biases[j]], // [numHeads, headDim]
        )
      }
      weights.push(
        ["multi_head_attention/output_dense/kernel", get(p + "attn.c_proj.weight")], // [numHeads, headDim, out]
        ["multi_head_attention/output_dense/bias", get(p + "attn.c_proj.bias")],
      )
      norm(p + "ln_2")
      for (const name of ["c_fc", "c_proj"]) {
        weights.push(
          ["dense/kernel", get(p + `mlp.${name}.weight`)],
          ["dense/bias", get(p + `mlp.${name}.bias`)],
        )
      }
    }
    norm("ln_f")

    for (const [i, [kind]] of weights.entries()) {
      const specKind = weightSpecs[i] && getKind(weightSpecs[i].name)
      if (specKind !== kind) throw new Error(`Weight ${i}: expected ${kind}, model has ${specKind}`)
    }
    return weights.map(([, data]) => data)
  },
}

function getTensor(tensors: SafeTensors, name: string) {
  const tensor = tensors[name] ?? tensors[`transformer.${name}`] // prefix in some checkpoints
  if (!tensor) throw new Error(`Missing tensor ${name}`)
  return tensor
}

// e.g. "multi_head_attention_12/query_dense/kernel" -> "multi_head_attention/query_dense/kernel"
const getKind = (name: string) => name.replace(/_\d+\//g, "/")

// [rows, numParts * partCols] -> numParts x [rows, partCols]
export function splitColumns(data: Float32Array, rows: number, numParts: number) {
  const cols = data.length / rows
  const partCols = cols / numParts
  return Array.from({ length: numParts }, (_, j) => {
    const part = new Float32Array(rows * partCols)
    for (let r = 0; r < rows; r++) {
      const start = r * cols + j * partCols
      part.set(data.subarray(start, start + partCols), r * partCols)
    }
    return part
  })
}
