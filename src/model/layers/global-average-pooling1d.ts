import * as tf from "@tensorflow/tfjs"
import { getGlobalPoolingInputNids } from "./get-input-nids"
import type { LayerDef } from "./types"

export const GlobalAveragePooling1D: LayerDef<"GlobalAveragePooling1D"> = {
  constructorFunc: tf.layers.globalAveragePooling1d,
  getInputNids: getGlobalPoolingInputNids,
  hasRegionInputsOnly: true, // the average of all positions: no single inputs stand out
}
