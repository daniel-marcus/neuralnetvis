import * as tf from "@tensorflow/tfjs"
import { randomRotation } from "./custom-layers"
import type { LayerConfigMap, LayerDef } from "./types"

const Dense: LayerDef<"Dense"> = {
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
}

const Conv2D: LayerDef<"Conv2D"> = {
  constructorFunc: tf.layers.conv2d,
  defaultConfig: {
    filters: 4,
    kernelSize: 3,
    activation: "relu",
    padding: "same",
  },
  options: [
    {
      name: "filters",
      inputType: "slider",
      min: 0,
      max: 6, // 2^6 = 64
      transformToSliderVal: (v) => Math.log2(v),
      transformFromSliderVal: (v) => 2 ** v,
    },
  ],
}

const MaxPooling2D: LayerDef<"MaxPooling2D"> = {
  constructorFunc: tf.layers.maxPooling2d,
  defaultConfig: {
    poolSize: 2,
  },
}

const Flatten: LayerDef<"Flatten"> = {
  constructorFunc: tf.layers.flatten,
  defaultConfig: {},
}

const Dropout: LayerDef<"Dropout"> = {
  constructorFunc: tf.layers.dropout,
  defaultConfig: {
    rate: 0.2,
  },
  options: [
    {
      name: "rate",
      inputType: "slider",
      min: 0,
      max: 0.95,
      step: 0.05,
    },
  ],
}

const InputLayer: LayerDef<"InputLayer"> = {
  constructorFunc: tf.layers.inputLayer,
  defaultConfig: {},
}

const BatchNormalization: LayerDef<"BatchNormalization"> = {
  constructorFunc: ({ axis, ...rest }) => {
    console.log(
      `BatchNormalization: Provided axis (${axis} ignored to avoid shape mismatch`
    )
    return tf.layers.batchNormalization(rest)
  },
  defaultConfig: {},
}

const RandomRotation: LayerDef<"RandomRotation"> = {
  constructorFunc: randomRotation,
  defaultConfig: {
    factor: 0.1,
  },
  options: [
    {
      name: "factor",
      inputType: "slider",
      min: 0,
      max: 0.5,
      step: 0.05,
    },
  ],
}

export const layerDefMap: { [K in keyof LayerConfigMap]: LayerDef<K> } = {
  Dense,
  Conv2D,
  MaxPooling2D,
  Flatten,
  Dropout,
  InputLayer,
  BatchNormalization,
  RandomRotation,
}
