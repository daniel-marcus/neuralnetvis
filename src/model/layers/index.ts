import { Dense } from "./dense"
import { Conv2D } from "./conv2d"
import { MaxPooling2D } from "./max-pooling2d"
import { Flatten } from "./flatten"
import { Dropout } from "./dropout"
import { InputLayer } from "./input-layer"
import { BatchNormalization } from "./batch-normalization"
import { LayerNormalization } from "./layer-normalization"
import { RandomRotation } from "./random-rotation"
import { DepthwiseConv2D } from "./depthwise-conv2d"
import { ReLU } from "./relu"
import { ZeroPadding2D } from "./zero-padding2d"
import { Activation } from "./activation"
import { Embedding } from "./embedding"
import { PositionEmbedding } from "./position-embedding"
import { Add } from "./add"
import { MultiHeadAttention } from "./multi-head-attention"
import type { LayerConfigMap, LayerDef } from "./types"

export const layerDefMap: { [K in keyof LayerConfigMap]: LayerDef<K> } = {
  Dense,
  Conv2D,
  MaxPooling2D,
  Flatten,
  Dropout,
  InputLayer,
  BatchNormalization,
  LayerNormalization,
  RandomRotation,
  DepthwiseConv2D,
  ReLU,
  ZeroPadding2D,
  Activation,
  Embedding,
  PositionEmbedding,
  Add,
  MultiHeadAttention,
}

export function getLayerDef<T extends keyof LayerConfigMap>(
  className: T | string
): LayerDef<T> | undefined {
  const layerDef =
    className in layerDefMap ? layerDefMap[className as T] : undefined
  // if (!layerDef) console.warn(`Layer definition for ${className} not found`)
  return layerDef
}
