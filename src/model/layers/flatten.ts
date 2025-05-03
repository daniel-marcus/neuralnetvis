import * as tf from "@tensorflow/tfjs"
import { getOneToOneInputNids } from "./get-input-nids"
import type { LayerDef } from "./types"

export const Flatten: LayerDef<"Flatten"> = {
  constructorFunc: tf.layers.flatten,
  defaultConfig: {},
  isInvisible: true,
  getInputNids: getOneToOneInputNids,
}
