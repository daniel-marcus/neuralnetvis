import * as tf from "@tensorflow/tfjs"
import type { LayerDef } from "./types"

export const Add: LayerDef<"Add"> = {
  constructorFunc: tf.layers.add,
  isUserAddable: false, // TODO
}
