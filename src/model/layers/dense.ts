import * as tf from "@tensorflow/tfjs"
import type { LayerDef } from "./types"
import { getIndex3d, getNid, getUnits } from "@/neuron-layers/layers-stateless"

export const Dense: LayerDef<"Dense"> = {
  constructorFunc: tf.layers.dense,
  defaultConfig: {
    units: 64,
    activation: "relu",
  },
  options: [
    {
      name: "units",
      inputType: "slider",
      min: 0,
      max: 9, // 0^9 = 512
      transformToSliderVal: (v) => Math.log2(v),
      transformFromSliderVal: (v) => 2 ** v,
    },
  ],
  isUserAddable: true,
  getInputNids: (l, prev, prevIdx) => {
    // fully connected layer / Dense: each neuron is connected to all neurons in the previous layer
    const shape = prev.outputShape as number[]
    const prevUnits = getUnits(prev)
    return Array.from({ length: getUnits(l) }).map(() =>
      Array.from({ length: prevUnits }).map((_, i) => {
        const index3d = getIndex3d(i, shape)
        return getNid(prevIdx, index3d)
      })
    )
  },
}
