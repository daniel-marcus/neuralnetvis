import type { SafeTensors, SafetensorsMapper } from "."

// LFM2 checkpoint (e.g. https://huggingface.co/LiquidAI/LFM2.5-350M) -> model.json of ml-notebooks/lfm2.py.
// Same mapping as load_lfm2_weights there, keep both in sync!
// By the names of the layers (block_{i}_{part}), not by their order:
// - torch Linear weights [out, in] -> Dense kernels [in, out]: transposed
// - conv.in_proj [3 * hidden, in] = B, C, x stacked -> 3 Dense layers (conv_b, conv_c, conv_x)
// - conv.conv [hidden, 1, kernelSize] -> DepthwiseConv1D kernel [kernelSize, hidden, 1]
// - q/k/v_proj [heads * headDim, in] -> [in, heads, headDim], out_proj [out, heads * headDim] -> [heads, headDim,
//   out]: transposed (RotaryGroupQueryAttention)
// - model.embedding_norm is the final norm (after the last block, despite its name)
export const mapLfm2: SafetensorsMapper = {
  map(tensors, weightSpecs) {
    return weightSpecs.map(({ name }) => getWeight(tensors, name))
  },
}

// block parts of the Keras model -> [tensor name in the block (model.layers.{i}.), conversion]
const BLOCK_WEIGHTS: Record<string, [string, Conversion]> = {
  "operator_norm/scale": ["operator_norm.weight", "none"],
  "conv_b/kernel": ["conv.in_proj.weight", "inProjB"],
  "conv_c/kernel": ["conv.in_proj.weight", "inProjC"],
  "conv_x/kernel": ["conv.in_proj.weight", "inProjX"],
  "conv/depthwise_kernel": ["conv.conv.weight", "transpose"], // [hidden, 1, k] -> [k, hidden, 1]
  "conv_out/kernel": ["conv.out_proj.weight", "transpose"],
  "attention/query/kernel": ["self_attn.q_proj.weight", "transpose"],
  "attention/key/kernel": ["self_attn.k_proj.weight", "transpose"],
  "attention/value/kernel": ["self_attn.v_proj.weight", "transpose"],
  "attention/attention_output/kernel": ["self_attn.out_proj.weight", "transpose"],
  "attention/query_norm/scale": ["self_attn.q_layernorm.weight", "none"],
  "attention/key_norm/scale": ["self_attn.k_layernorm.weight", "none"],
  "ffn_norm/scale": ["ffn_norm.weight", "none"],
  "ffn_gate/kernel": ["feed_forward.w1.weight", "transpose"],
  "ffn_up/kernel": ["feed_forward.w3.weight", "transpose"],
  "ffn_down/kernel": ["feed_forward.w2.weight", "transpose"],
}

const OTHER_WEIGHTS: Record<string, string> = {
  "token_embedding/embeddings": "embed_tokens.weight", // [vocab, hidden] as in Keras
  "final_norm/scale": "embedding_norm.weight",
}

type Conversion = "none" | "transpose" | "inProjB" | "inProjC" | "inProjX"

function getWeight(tensors: SafeTensors, specName: string) {
  const other = OTHER_WEIGHTS[specName]
  if (other) return getTensor(tensors, other).data
  const [, block, part] = /^block_(\d+)_(.+)$/.exec(specName) ?? []
  const [tensorName, conversion] = BLOCK_WEIGHTS[part] ?? []
  if (!tensorName) throw new Error(`LFM2: unknown weight ${specName}`)
  const { data, shape } = getTensor(tensors, `layers.${block}.${tensorName}`)
  const [rows, cols] = [shape[0], data.length / shape[0]] // [out, in] (conv: [hidden, k])
  if (conversion === "none") return data
  if (conversion === "transpose") return transposeRows(data, cols, 0, rows)
  const part3 = rows / 3 // in_proj: B, C, x
  return transposeRows(
    data,
    cols,
    ["inProjB", "inProjC", "inProjX"].indexOf(conversion) * part3,
    part3,
  )
}

function getTensor(tensors: SafeTensors, name: string) {
  const tensor = tensors[`model.${name}`] ?? tensors[name] // without prefix: base model only
  if (!tensor) throw new Error(`Missing tensor model.${name}`)
  return tensor
}

// rows start .. start + numRows of data [rows, cols], transposed: [cols, numRows]
export function transposeRows(data: Float32Array, cols: number, start: number, numRows: number) {
  const out = new Float32Array(cols * numRows)
  for (let r = 0; r < numRows; r++) {
    const row = data.subarray((start + r) * cols, (start + r + 1) * cols)
    for (let c = 0; c < cols; c++) out[c * numRows + r] = row[c]
  }
  return out
}
