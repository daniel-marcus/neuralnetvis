import * as tf from "@tensorflow/tfjs"
import { LayerDef } from "./types"

export const ZeroPadding2D: LayerDef<"ZeroPadding2D"> = {
  constructorFunc: tf.layers.zeroPadding2d,
  defaultConfig: {},
  isInvisible: true,
}
