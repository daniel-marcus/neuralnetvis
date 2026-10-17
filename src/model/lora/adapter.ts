import * as tf from "@tensorflow/tfjs"
import type { LayersModel } from "@tensorflow/tfjs-layers"
import {
  getProjections,
  type Projection,
  type ProjectionDelta,
  type ProjectionName,
} from "@/model/layers/multi-head-attention"

// LoRA (https://arxiv.org/abs/2106.09685): the pretrained weights stay frozen, each adapted projection gets a
// trainable low-rank update y = x W + (x A B) * alpha / rank, A: [in, rank] random, B: [rank, out] zeros
// (starts as the base model).
// Targets of the MultiHeadAttention layers:
// - qkv: one A for query, key and value, B per projection. Same as LoRA on the fused c_attn of Hugging Face's
//   GPT-2 (B of c_attn = B of query, key and value side by side), the default target of PEFT for GPT-2
// - query, key, value, output: A and B per projection (output = attn.c_proj in GPT-2)

export type LoraTarget = "qkv" | ProjectionName

export interface LoraConfig {
  rank: number
  alpha: number
  targets: LoraTarget[]
}

export const DEFAULT_LORA_CONFIG: LoraConfig = { rank: 8, alpha: 16, targets: ["qkv"] }

// the projection has the delta of another adapter
const isOther = (projection: Projection, delta: ProjectionDelta) =>
  !!projection.delta && projection.delta !== delta

// tfjs variable names are global: unique prefix per adapter, the weights are keyed without it
let adapterCount = 0

export class LoraAdapter {
  readonly config: LoraConfig
  // e.g. "multi_head_attention_12/qkv/A", "multi_head_attention_12/qkv/B_query", "multi_head_attention_12/output/A"
  readonly weights = new Map<string, tf.Variable>()
  // adapted MultiHeadAttention layers in the order of the model (e.g. the transformer blocks)
  readonly layerNames: string[] = []
  private deltas = new Map<Projection, ProjectionDelta>()
  private _enabled = true
  private _isDetached = false

  constructor(model: LayersModel, config: LoraConfig = DEFAULT_LORA_CONFIG) {
    const { rank, alpha, targets } = config
    const hasQkv = targets.includes("qkv")
    if (hasQkv && targets.some((t) => t === "query" || t === "key" || t === "value")) {
      throw new Error("LoRA: qkv already includes query, key and value")
    }
    this.config = { ...config, targets: [...targets] }
    const prefix = `lora${adapterCount++}`
    const scale = alpha / rank

    const addWeight = (key: string, initialValue: tf.Tensor) => {
      const variable = tf.variable(initialValue, true, `${prefix}/${key}`)
      initialValue.dispose()
      this.weights.set(key, variable)
      return variable
    }
    const initA = (key: string, inDim: number) => {
      const bound = 1 / Math.sqrt(inDim) // as PEFT (kaiming_uniform with a = sqrt(5))
      return addWeight(`${key}/A`, tf.randomUniform([inDim, rank], -bound, bound))
    }
    const addDelta = (projection: Projection, A: tf.Variable, B: tf.Variable) => {
      if (projection.delta) throw new Error("LoRA: the model already has an adapter")
      this.deltas.set(projection, (x) => x.matMul(A).matMul(B).mul(scale))
    }

    try {
      const layers = model.layers.filter((l) => !!getProjections(l))
      if (!layers.length)
        throw new Error("LoRA: no MultiHeadAttention layers with matMul projections")
      for (const layer of layers) {
        this.layerNames.push(layer.name)
        const projections = getProjections(layer)!
        if (hasQkv) {
          const key = `${layer.name}/qkv`
          const A = initA(key, projections.query.inDim)
          for (const name of ["query", "key", "value"] as const) {
            const B = addWeight(`${key}/B_${name}`, tf.zeros([rank, projections[name].outDim]))
            addDelta(projections[name], A, B)
          }
        }
        for (const name of targets.filter((t) => t !== "qkv")) {
          const key = `${layer.name}/${name}`
          const A = initA(key, projections[name].inDim)
          const B = addWeight(`${key}/B`, tf.zeros([rank, projections[name].outDim]))
          addDelta(projections[name], A, B)
        }
      }
    } catch (e) {
      tf.dispose([...this.weights.values()])
      throw e
    }
    this.setDeltas(true)
  }

  get vars() {
    return [...this.weights.values()]
  }

  get numParams() {
    return this.vars.reduce((n, v) => n + v.size, 0)
  }

  get enabled() {
    return this._enabled
  }

  get isDetached() {
    return this._isDetached
  }

  // disabled: the model computes the base outputs, the weights are kept (e.g. to compare)
  setEnabled(enabled: boolean) {
    if (this._isDetached) throw new Error("LoRA: adapter is detached")
    this.setDeltas(enabled)
    this._enabled = enabled
  }

  // e.g. imported weights (see peft.ts): all keys with the same shapes, nothing is assigned if one doesn't match
  setWeights(values: Map<string, tf.Tensor>) {
    if (this._isDetached) throw new Error("LoRA: adapter is detached")
    for (const key of values.keys()) {
      if (!this.weights.has(key)) throw new Error(`LoRA: unknown weight ${key}`)
    }
    for (const [key, variable] of this.weights) {
      const value = values.get(key)
      if (!value) throw new Error(`LoRA: missing weight ${key}`)
      if (!tf.util.arraysEqual(value.shape, variable.shape)) {
        throw new Error(`LoRA: ${key} has shape [${value.shape}], expected [${variable.shape}]`)
      }
    }
    for (const [key, variable] of this.weights) variable.assign(values.get(key)!)
  }

  // restores the base model and disposes the weights
  detach() {
    if (this._isDetached) return
    this.setDeltas(false)
    tf.dispose(this.vars)
    this._isDetached = true
  }

  private setDeltas(active: boolean) {
    if (active && [...this.deltas].some(([p, d]) => isOther(p, d))) {
      throw new Error("LoRA: the model already has another adapter")
    }
    for (const [projection, delta] of this.deltas) {
      if (!isOther(projection, delta)) projection.delta = active ? delta : undefined
    }
  }
}

export function attachLora(model: LayersModel, config?: LoraConfig) {
  return new LoraAdapter(model, config)
}
