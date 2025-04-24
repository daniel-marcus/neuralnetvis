import * as tf from "@tensorflow/tfjs"
import { LayerDef } from "./types"

export const Activation: LayerDef<"Activation"> = {
  constructorFunc: tf.layers.activation,
  defaultConfig: { activation: "relu" },
  isInvisible: true,
}
