import * as tf from "@tensorflow/tfjs"
import { Layer, type LayerArgs } from "@tensorflow/tfjs-layers/dist/engine/topology"
import type { LayerVariable } from "@tensorflow/tfjs-layers/dist/variables"
import { getOneToOneInputNids } from "./get-input-nids"
import type { LayerDef } from "./types"

// x / sqrt(mean(x^2) + epsilon) * scale over the features (last axis): LayerNormalization without centering and
// bias, as in Llama, Qwen or LFM2 models
// reference: https://github.com/keras-team/keras/blob/v3.15.1/keras/src/layers/normalization/rms_normalization.py

export const RMSNormalization: LayerDef<"RMSNormalization"> = {
  constructorFunc: (args) => new RMSNormalizationLayer(args),
  defaultConfig: {},
  isUserAddable: true,
  getInputNids: getOneToOneInputNids,
}

export interface RMSNormalizationLayerArgs extends LayerArgs {
  axis?: number | number[] // only the last axis (Keras: [-1])
  epsilon?: number
}

// Layer from the ESM files of tfjs-layers, see multi-head-attention.ts
class RMSNormalizationLayer extends Layer {
  static className = "RMSNormalization"
  private epsilon: number
  private scale!: LayerVariable

  constructor(args: RMSNormalizationLayerArgs = {}) {
    super(args)
    const axis = Array.isArray(args.axis) ? args.axis : [args.axis ?? -1]
    if (axis.length !== 1 || axis[0] !== -1) {
      throw new Error(`RMSNormalization: only axis -1 is supported, got [${axis}]`)
    }
    this.epsilon = args.epsilon ?? 1e-6 // Keras default
  }

  override build(inputShape: tf.Shape | tf.Shape[]): void {
    const shape = (Array.isArray(inputShape[0]) ? inputShape[0] : inputShape) as tf.Shape
    const features = shape[shape.length - 1] as number
    this.scale = this.addWeight("scale", [features], "float32", tf.initializers.ones())
    this.built = true
  }

  override computeOutputShape(inputShape: tf.Shape | tf.Shape[]) {
    return inputShape
  }

  override call(inputs: tf.Tensor | tf.Tensor[]): tf.Tensor {
    return tf.tidy(() => {
      const x = Array.isArray(inputs) ? inputs[0] : inputs
      return rmsNormalize(x, this.scale.read(), this.epsilon)
    })
  }

  override getConfig(): tf.serialization.ConfigDict {
    return { ...super.getConfig(), axis: -1, epsilon: this.epsilon }
  }
}

// over the last axis, scale: [features] (also used for the qk-norm of RotaryGroupQueryAttention)
export function rmsNormalize(x: tf.Tensor, scale: tf.Tensor, epsilon: number) {
  return tf.tidy(() => x.mul(x.square().mean(-1, true).add(epsilon).rsqrt()).mul(scale))
}

tf.serialization.registerClass(RMSNormalizationLayer)
