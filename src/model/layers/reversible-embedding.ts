import * as tf from "@tensorflow/tfjs"
import {
  getInitializer,
  serializeInitializer,
  type Initializer,
} from "@tensorflow/tfjs-layers/dist/initializers"
import type { LayerArgs } from "@tensorflow/tfjs-layers/dist/engine/topology"
import type { LayerDef } from "./types"

// Embedding with tied weights: called a 2nd time at the end of the model, it projects back to the vocabulary
// (logits = x @ embeddings.T), see import-keras.ts for the softmax that is added after it
// reference: https://github.com/keras-team/keras/blob/v3.15.1/keras/src/layers/core/reversible_embedding.py

export const ReversibleEmbedding: LayerDef<"ReversibleEmbedding"> = {
  constructorFunc: (args) => new ReversibleEmbeddingLayer(args),
  // not user addable: the reverse call can't be expressed in the layer editor
}

export interface ReversibleEmbeddingLayerArgs extends LayerArgs {
  inputDim: number // vocabulary size
  outputDim: number
  embeddingsInitializer?: string | tf.serialization.ConfigDict
  tieWeights?: boolean
  logitSoftCap?: number | null
}

class ReversibleEmbeddingLayer extends tf.layers.Layer {
  static className = "ReversibleEmbedding"
  private inputDim: number
  private outputDim: number
  private embeddingsInitializer: Initializer
  private embeddings!: tf.LayerVariable

  constructor(args: ReversibleEmbeddingLayerArgs) {
    super(args)
    if (args.tieWeights === false || args.logitSoftCap) {
      throw new Error(
        "ReversibleEmbedding: only tie_weights=True without logit_soft_cap is supported",
      )
    }
    this.inputDim = args.inputDim
    this.outputDim = args.outputDim
    this.embeddingsInitializer = getInitializer(args.embeddingsInitializer ?? "randomUniform")
  }

  override build(): void {
    if (this.embeddings) return // 2nd (reverse) call shares the weights
    this.embeddings = this.addWeight(
      "embeddings",
      [this.inputDim, this.outputDim],
      "float32",
      this.embeddingsInitializer,
    )
    this.built = true
  }

  // the direction is determined by the input rank, because tfjs doesn't pass the call kwargs (reverse=True)
  // to computeOutputShape: token ids [batch, seq] -> embeddings, vectors [batch, seq, outputDim] -> logits
  private isReverse(inputShape: tf.Shape) {
    return inputShape.length > 2
  }

  override computeOutputShape(inputShape: tf.Shape | tf.Shape[]): tf.Shape {
    const shape = (Array.isArray(inputShape[0]) ? inputShape[0] : inputShape) as tf.Shape
    return this.isReverse(shape)
      ? [...shape.slice(0, -1), this.inputDim]
      : [...shape, this.outputDim]
  }

  override call(inputs: tf.Tensor | tf.Tensor[]): tf.Tensor {
    return tf.tidy(() => {
      const input = Array.isArray(inputs) ? inputs[0] : inputs
      const embeddings = this.embeddings.read()
      if (!this.isReverse(input.shape)) {
        return tf.gather(embeddings, tf.cast(input, "int32"))
      }
      const flat = tf.reshape(input, [-1, this.outputDim])
      const logits = tf.matMul(flat, embeddings, false, true)
      return tf.reshape(logits, [...input.shape.slice(0, -1), this.inputDim])
    })
  }

  // tfjs throws for layers with multiple inbound nodes with different shapes, use the embedding output
  // (1st call) for the visualization
  override get outputShape(): tf.Shape {
    const [shape] = this.inboundNodes[0].outputShapes as tf.Shape[] // a list of shapes, one per output
    return shape
  }

  override getConfig(): tf.serialization.ConfigDict {
    const config = {
      inputDim: this.inputDim,
      outputDim: this.outputDim,
      embeddingsInitializer: serializeInitializer(this.embeddingsInitializer),
    }
    return { ...super.getConfig(), ...config }
  }
}

tf.serialization.registerClass(ReversibleEmbeddingLayer)
