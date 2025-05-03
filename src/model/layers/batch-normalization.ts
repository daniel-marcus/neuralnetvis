import * as tf from "@tensorflow/tfjs"
import { getOneToOneInputNids } from "./get-input-nids"
import type { LayerDef } from "./types"

export const BatchNormalization: LayerDef<"BatchNormalization"> = {
  constructorFunc: ({ axis, ...rest }) => {
    console.log(
      `BatchNormalization: Provided axis (${axis} ignored to avoid shape mismatch`
    )
    return tf.layers.batchNormalization(rest)
  },
  defaultConfig: {},
  isInvisible: true,
  isUserAddable: true,
  getInputNids: getOneToOneInputNids,
}
