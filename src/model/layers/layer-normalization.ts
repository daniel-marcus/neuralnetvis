import * as tf from "@tensorflow/tfjs"
import type { LayerDef } from "./types"
import { getIndex3d, getNid, getUnits } from "@/neuron-layers/layers-stateless"

export const LayerNormalization: LayerDef<"LayerNormalization"> = {
  constructorFunc: tf.layers.layerNormalization,
  defaultConfig: {},
  isInvisible: true,
  isUserAddable: true,
  getInputNids: (l, prev, prevIdx) => {
    // each neuron is connected to 1 neuron in the previous layer
    const shape = prev.outputShape as number[]
    return Array.from({ length: getUnits(l) }).map((_, i) => {
      const index3d = getIndex3d(i, shape)
      return [getNid(prevIdx, index3d)]
    })
  },
}
