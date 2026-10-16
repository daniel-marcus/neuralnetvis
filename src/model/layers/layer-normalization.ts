import * as tf from "@tensorflow/tfjs"
import { LayerNormalization as TfjsLayerNormalization } from "@tensorflow/tfjs-layers/dist/layers/normalization"
import type { LayerVariable } from "@tensorflow/tfjs-layers/dist/variables"
import { getOneToOneInputNids } from "./get-input-nids"
import type { LayerDef } from "./types"

// fields of tfjs' LayerNormalization that are private in its typings (axis: resolved to an array in build)
type LayerNormalizationInternals = {
  axis: number[]
  gamma: LayerVariable | null
  beta: LayerVariable | null
}

// tfjs tiles mean, variance, gamma and beta to the input shape before batchNormalization (workaround for
// https://github.com/tensorflow/tfjs/issues/2120). The gradient of tile is a loop of slice + add per repeat:
// ~1500 kernels per layer in each backward pass of GPT-2 (LoRA training 3x slower). Broadcasting instead.
class BroadcastLayerNormalization extends TfjsLayerNormalization {
  call(inputs: tf.Tensor | tf.Tensor[]): tf.Tensor {
    return tf.tidy(() => {
      const x = Array.isArray(inputs) ? inputs[0] : inputs
      const { axis, gamma, beta } = this as unknown as LayerNormalizationInternals
      const { mean, variance } = tf.moments(x, axis, true)
      const paramShape = x.shape.map((size, i) => (axis.includes(i) ? size : 1))
      let y = x.sub(mean).mul(variance.add(this.epsilon).rsqrt())
      if (gamma) y = y.mul(gamma.read().reshape(paramShape))
      if (beta) y = y.add(beta.read().reshape(paramShape))
      return y
    })
  }
}

export const LayerNormalization: LayerDef<"LayerNormalization"> = {
  constructorFunc: (args) => new BroadcastLayerNormalization(args),
  defaultConfig: {},
  // isInvisible: true,
  isUserAddable: true,
  getInputNids: getOneToOneInputNids,
}

// replaces tfjs' class for "LayerNormalization" (same className), also when loading models
tf.serialization.registerClass(BroadcastLayerNormalization)
