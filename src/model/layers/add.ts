import * as tf from "@tensorflow/tfjs"
import type { LayerDef } from "./types"

export const Add: LayerDef<"Add"> = {
  constructorFunc: tf.layers.add,
  isUserAddable: true,
  options: [
    {
      name: "otherLayerNames",
      inputType: "select",
      getValue: ({ layerConfig }) => layerConfig.inboundNodes?.[0]?.[1]?.[0], // name string from 2nd inbound node (1st is previous layer)
      options: ({ layerConfig, layerConfigs }) => {
        const layerIdx = layerConfigs.indexOf(layerConfig)
        return layerConfigs
          .slice(0, layerIdx) // previous layers only
          .map((l) => l.config.name ?? "") // TODO: filter same shape
      },
    },
  ],
  // TODO: validOrder checks?
}
