import * as tf from "@tensorflow/tfjs"
import { getOneToOneInputNids } from "./get-input-nids"
import type { LayerDef } from "./types"

export const LayerNormalization: LayerDef<"LayerNormalization"> = {
  constructorFunc: tf.layers.layerNormalization,
  defaultConfig: {},
  isInvisible: true,
  isUserAddable: true,
  getInputNids: getOneToOneInputNids,
}
