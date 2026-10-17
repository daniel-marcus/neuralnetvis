import * as tf from "@tensorflow/tfjs"
import type { LayersModel } from "@tensorflow/tfjs-layers"
import { parseSafetensors, writeSafetensors, type SafeTensor } from "@/model/safetensors"
import { attachLora, type LoraAdapter, type LoraConfig, type LoraTarget } from "./adapter"

// LoRA adapters in the format of Hugging Face PEFT (https://huggingface.co/docs/peft): adapter_model.safetensors
// + adapter_config.json, as saved by PeftModel.save_pretrained for GPT-2 (GPT2LMHeadModel).
// Same block order as the MultiHeadAttention layers of the model, A and B are transposed (nn.Linear weights):
// - qkv = attn.c_attn (fused query, key, value): lora_A [rank, in] = A^T, lora_B [3 * out, rank] = (B_query |
//   B_key | B_value)^T
// - output = attn.c_proj: lora_A = A^T, lora_B = B^T
// - separate query, key, value targets: no module in PEFT (c_attn is fused), can't be exported

export const PEFT_WEIGHTS_FILE = "adapter_model.safetensors"
export const PEFT_CONFIG_FILE = "adapter_config.json"

// fields of PEFT's LoraConfig used here
export interface PeftLoraConfig {
  peft_type: string
  task_type?: string
  base_model_name_or_path?: string | null
  r: number
  lora_alpha: number
  lora_dropout?: number
  target_modules?: string[] | string | null
  fan_in_fan_out?: boolean
  bias?: string
  use_rslora?: boolean
  use_dora?: boolean
  rank_pattern?: Record<string, number>
  alpha_pattern?: Record<string, number>
  inference_mode?: boolean
}

const MODULES: Partial<Record<LoraTarget, string>> = { qkv: "c_attn", output: "c_proj" }
// PEFT matches the suffix of the module names: "c_proj" would also adapt mlp.c_proj
const TARGET_MODULES: Partial<Record<LoraTarget, string>> = { qkv: "c_attn", output: "attn.c_proj" }
const QKV = ["query", "key", "value"] as const

const tensorName = (block: number, module: string, ab: "A" | "B") =>
  `base_model.model.transformer.h.${block}.attn.${module}.lora_${ab}.weight`

// also without "transformer." (GPT2Model as base model)
const TENSOR_NAME =
  /^base_model\.model\.(?:transformer\.)?h\.(\d+)\.attn\.(\w+)\.lora_([AB])\.weight$/

const hasPattern = (p?: Record<string, number>) => !!p && Object.keys(p).length > 0

export async function exportPeft(adapter: LoraAdapter, baseModel?: string) {
  if (adapter.isDetached) throw new Error("LoRA: adapter is detached")
  const { rank, alpha, targets } = adapter.config
  const unsupported = targets.filter((t) => !MODULES[t])
  if (unsupported.length) {
    throw new Error(`LoRA: no PEFT module for ${unsupported.join(", ")} (only qkv and output)`)
  }
  const transposed = tf.tidy(() => {
    const tensors: Record<string, tf.Tensor> = {}
    for (const [block, layerName] of adapter.layerNames.entries()) {
      for (const target of targets) {
        const get = (key: string) => adapter.weights.get(`${layerName}/${target}/${key}`)!
        const B =
          target === "qkv"
            ? tf.concat(
                QKV.map((n) => get(`B_${n}`)),
                1,
              )
            : get("B")
        tensors[tensorName(block, MODULES[target]!, "A")] = get("A").transpose()
        tensors[tensorName(block, MODULES[target]!, "B")] = B.transpose()
      }
    }
    return tensors
  })
  const safeTensors: Record<string, Pick<SafeTensor, "shape" | "data">> = {}
  try {
    for (const [name, t] of Object.entries(transposed)) {
      safeTensors[name] = { shape: t.shape, data: (await t.data()) as Float32Array }
    }
  } finally {
    tf.dispose(Object.values(transposed))
  }
  const config: PeftLoraConfig = {
    peft_type: "LORA",
    task_type: "CAUSAL_LM",
    base_model_name_or_path: baseModel ?? null,
    r: rank,
    lora_alpha: alpha,
    lora_dropout: 0,
    target_modules: targets.map((t) => TARGET_MODULES[t]!),
    fan_in_fan_out: true, // Conv1D of GPT-2
    bias: "none",
    use_rslora: false,
    inference_mode: true,
  }
  return { weights: writeSafetensors(safeTensors), config }
}

// attaches a new adapter with the imported weights: the model must not have an active adapter
export function importPeft(model: LayersModel, buffer: ArrayBuffer, peftConfig: PeftLoraConfig) {
  const { peft_type, r: rank, lora_alpha, use_rslora, use_dora, bias } = peftConfig
  if (peft_type !== "LORA") throw new Error(`LoRA: unsupported PEFT type ${peft_type}`)
  if (use_dora) throw new Error("LoRA: DoRA adapters are not supported")
  if (bias && bias !== "none") throw new Error(`LoRA: bias "${bias}" is not supported`)
  if (hasPattern(peftConfig.rank_pattern) || hasPattern(peftConfig.alpha_pattern)) {
    throw new Error("LoRA: different ranks or alphas per module are not supported")
  }

  // the targets are the modules in the weights file (target_modules can be a regex)
  const tensors = new Map<string, SafeTensor>() // e.g. "3/c_attn/A"
  const modules = new Set<string>()
  for (const [name, tensor] of Object.entries(parseSafetensors(buffer))) {
    const [, block, moduleName, ab] = name.match(TENSOR_NAME) ?? []
    if (!moduleName) throw new Error(`LoRA: unsupported tensor ${name}`)
    tensors.set(`${block}/${moduleName}/${ab}`, tensor)
    modules.add(moduleName)
  }
  const targets = [...modules].map((moduleName) => {
    const target = (Object.keys(MODULES) as LoraTarget[]).find((t) => MODULES[t] === moduleName)
    if (!target) throw new Error(`LoRA: unsupported module ${moduleName} (only c_attn and c_proj)`)
    return target
  })
  if (!targets.length) throw new Error("LoRA: no LoRA weights in the file")

  // rsLoRA scales with alpha / sqrt(rank) instead of alpha / rank
  const alpha = use_rslora ? lora_alpha * Math.sqrt(rank) : lora_alpha
  const config: LoraConfig = { rank, alpha, targets }
  const adapter = attachLora(model, config)
  try {
    tf.tidy(() => {
      const values = new Map<string, tf.Tensor>()
      for (const [block, layerName] of adapter.layerNames.entries()) {
        for (const target of targets) {
          const get = (ab: "A" | "B") => {
            const key = `${block}/${MODULES[target]}/${ab}`
            const tensor = tensors.get(key)
            if (!tensor) throw new Error(`LoRA: missing ${tensorName(block, MODULES[target]!, ab)}`)
            tensors.delete(key)
            return tf.tensor(tensor.data, tensor.shape).transpose()
          }
          const key = `${layerName}/${target}`
          values.set(`${key}/A`, get("A"))
          const B = get("B") // [rank, out]
          if (target === "qkv") {
            if (B.shape[1]! % 3)
              throw new Error(`LoRA: c_attn lora_B of block ${block} is not q|k|v`)
            tf.split(B, 3, 1).forEach((b, i) => values.set(`${key}/B_${QKV[i]}`, b))
          } else values.set(`${key}/B`, B)
        }
      }
      if (tensors.size) {
        const blocks = adapter.layerNames.length
        throw new Error(`LoRA: the adapter has more blocks than the model (${blocks})`)
      }
      adapter.setWeights(values)
    })
  } catch (e) {
    adapter.detach()
    throw e
  }
  return adapter
}
