import * as tf from "@tensorflow/tfjs"
import { Activation as ActivationFunc } from "@tensorflow/tfjs-layers/dist/activations"
import type { LayerDef } from "./types"

export const Activation: LayerDef<"Activation"> = {
  constructorFunc: tf.layers.activation,
  defaultConfig: { activation: "relu" },
  isInvisible: true,
}

// Keras' "silu" (x * sigmoid(x), e.g. the gates of SwiGLU MLPs), in tfjs only as "swish"
class Silu extends ActivationFunc {
  static className = "silu"
  apply(x: tf.Tensor) {
    return tf.tidy(() => tf.sigmoid(x).mul(x))
  }
}

tf.serialization.registerClass(Silu)
