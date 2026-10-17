import * as tf from "@tensorflow/tfjs"
import { getOneToOneInputNids } from "./get-input-nids"
import type { LayerDef } from "./types"

// element-wise product of the inputs, e.g. the gates of SwiGLU MLPs and LFM2's short convolutions
export const Multiply: LayerDef<"Multiply"> = {
  constructorFunc: tf.layers.multiply,
  getInputNids: getOneToOneInputNids, // for every input layer
}
