import * as tf from "@tensorflow/tfjs"
import type { LayerDef } from "./types"

export const Flatten: LayerDef<"Flatten"> = {
  constructorFunc: tf.layers.flatten,
  defaultConfig: {},
  isInvisible: true,
}
