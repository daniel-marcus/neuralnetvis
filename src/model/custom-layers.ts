import * as tf from "@tensorflow/tfjs"
import type { LayerArgs } from "@tensorflow/tfjs-layers/dist/engine/topology"

export interface RandomRotationLayerArgs extends LayerArgs {
  factor?: number
  applyAtInference?: boolean
}

export class RandomRotation extends tf.layers.Layer {
  factor: number
  applyAtInference: boolean

  constructor(config: RandomRotationLayerArgs) {
    super(config)
    this.factor = config.factor ?? 1 // 1 = 360 degrees
    this.applyAtInference = config.applyAtInference ?? true
  }

  computeOutputShape(inputShape: tf.Shape) {
    return inputShape
  }

  call(_inputs: tf.Tensor | tf.Tensor[], { training }: { training?: boolean }) {
    if (!training && !this.applyAtInference) return _inputs

    const inputs = Array.isArray(_inputs) ? _inputs[0] : _inputs

    const factorRadians = this.factor * Math.PI * 2
    return tf.tidy(() => {
      const angle = tf
        .randomUniform([1], -factorRadians, factorRadians)
        .dataSync()[0]
      return tf.image.rotateWithOffset(inputs as tf.Tensor4D, angle)
    })
  }

  getConfig() {
    const config = super.getConfig()
    return { ...config, factor: this.factor }
  }

  static get className() {
    return "RandomRotation"
  }
}

tf.serialization.registerClass(RandomRotation)
