import * as tf from "@tensorflow/tfjs"
import {
  getInitializer,
  serializeInitializer,
  type Initializer,
} from "@tensorflow/tfjs-layers/dist/initializers"
import type { LayerArgs } from "@tensorflow/tfjs-layers/dist/engine/topology"
import type { LayerDef } from "./types"

// reference: https://github.com/keras-team/keras-hub/blob/v0.20.0/keras_hub/src/layers/modeling/position_embedding.py

export const PositionEmbedding: LayerDef<"PositionEmbedding"> = {
  constructorFunc: (args) => new PositionEmbeddingLayer(args),
  defaultConfig: {
    sequenceLength: 8,
  },
  isUserAddable: true,
}

export interface PositionEmbeddingLayerArgs extends LayerArgs {
  sequenceLength: number
  initializer?: string
}

export class PositionEmbeddingLayer extends tf.layers.Layer {
  static className = "PositionEmbedding"
  private sequenceLength: number
  private initializer: Initializer
  private positionEmbeddings!: tf.LayerVariable

  constructor(args: PositionEmbeddingLayerArgs) {
    super(args)
    this.sequenceLength = args.sequenceLength
    this.initializer = getInitializer(args.initializer ?? "glorotUniform")
  }

  override build(inputShape: tf.Shape): void {
    const featureSize = inputShape[inputShape.length - 1] as number

    this.positionEmbeddings = this.addWeight(
      "embeddings",
      [this.sequenceLength, featureSize],
      undefined, // dtype
      this.initializer,
      undefined, // regularizer
      true // trainable
    )

    this.built = true
  }

  override call(
    inputs: tf.Tensor | tf.Tensor[],
    kwargs: { startIndex?: number } = {}
  ): tf.Tensor | tf.Tensor[] {
    const startIndex = kwargs.startIndex || 0
    const inputTensor = Array.isArray(inputs) ? inputs[0] : inputs
    const inputShape = inputTensor.shape
    const featureLength = inputShape[inputShape.length - 1] as number
    const sequenceLength = inputShape[inputShape.length - 2] as number

    const positionEmbeds = this.positionEmbeddings.read() as tf.Tensor
    const sliced = tf.slice(
      positionEmbeds,
      [startIndex, 0],
      [sequenceLength, featureLength]
    )

    const broadcastShape = [...inputShape]
    return tf.broadcastTo(sliced, broadcastShape)
  }

  override getConfig(): tf.serialization.ConfigDict {
    const config = {
      sequenceLength: this.sequenceLength,
      initializer: serializeInitializer(this.initializer),
    }
    return { ...super.getConfig(), ...config }
  }
}

tf.serialization.registerClass(PositionEmbeddingLayer)
