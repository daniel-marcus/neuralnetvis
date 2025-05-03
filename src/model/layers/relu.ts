import * as tf from "@tensorflow/tfjs"
import { getOneToOneInputNids } from "./get-input-nids"
import { LayerDef } from "./types"

export const ReLU: LayerDef<"ReLU"> = {
  constructorFunc: tf.layers.reLU,
  defaultConfig: {},
  isInvisible: true,
  getInputNids: getOneToOneInputNids,
}
