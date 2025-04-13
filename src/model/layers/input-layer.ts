import * as tf from "@tensorflow/tfjs"
import type { LayerDef } from "./types"

export const InputLayer: LayerDef<"InputLayer"> = {
  constructorFunc: tf.layers.inputLayer,
  defaultConfig: {},
}
