import * as tf from "@tensorflow/tfjs"
import { Layer, type LayerArgs } from "@tensorflow/tfjs-layers/dist/engine/topology"
import type { LayerDef } from "./types"

// zeros before and after the sequence [batch, steps, features], e.g. padding [kernelSize - 1, 0] before a
// DepthwiseConv1D: a causal convolution (LFM2's short convolutions, see ml-notebooks/lfm2.py)
// reference: https://github.com/keras-team/keras/blob/v3.15.1/keras/src/layers/reshaping/zero_padding1d.py

export const ZeroPadding1D: LayerDef<"ZeroPadding1D"> = {
  constructorFunc: (args) => new ZeroPadding1DLayer(args),
  // invisible: the following layer is connected to the unpadded positions (see getConv1DInputNids)
  isInvisible: true,
}

export interface ZeroPadding1DLayerArgs extends LayerArgs {
  padding?: number | [number, number] // [before, after]
}

// Layer from the ESM files of tfjs-layers, see multi-head-attention.ts
export class ZeroPadding1DLayer extends Layer {
  static className = "ZeroPadding1D"
  readonly padding: [number, number]

  constructor(args: ZeroPadding1DLayerArgs = {}) {
    super(args)
    const { padding = 1 } = args
    this.padding = typeof padding === "number" ? [padding, padding] : padding
  }

  override computeOutputShape(inputShape: tf.Shape | tf.Shape[]): tf.Shape {
    const [batch, steps, features] = (
      Array.isArray(inputShape[0]) ? inputShape[0] : inputShape
    ) as tf.Shape
    const [before, after] = this.padding
    return [batch, steps === null ? null : steps + before + after, features]
  }

  override call(inputs: tf.Tensor | tf.Tensor[]): tf.Tensor {
    return tf.tidy(() => {
      const x = Array.isArray(inputs) ? inputs[0] : inputs
      return tf.pad(x, [[0, 0], this.padding, [0, 0]])
    })
  }

  override getConfig(): tf.serialization.ConfigDict {
    return { ...super.getConfig(), padding: this.padding }
  }
}

tf.serialization.registerClass(ZeroPadding1DLayer)
