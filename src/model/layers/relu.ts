import * as tf from "@tensorflow/tfjs"
import { LayerDef } from "./types"

export const ReLU: LayerDef<"ReLU"> = {
  constructorFunc: tf.layers.reLU,
  defaultConfig: {},
  isInvisible: true,
}
