import * as tf from "@tensorflow/tfjs"
import type { LayerArgs } from "@tensorflow/tfjs-layers/dist/engine/topology"
import type { LayerDef } from "./types"

export const RandomRotation: LayerDef<"RandomRotation"> = {
  constructorFunc: randomRotation,
  defaultConfig: {
    factor: 0.1,
  },
  needsMultiDim: true,
  isUserAddable: true,
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

function randomRotation(args: RandomRotationLayerArgs) {
  return new RandomRotationLayer(args)
}

export interface RandomRotationLayerArgs extends LayerArgs {
  factor?: number
  applyAtInference?: boolean
}

export class RandomRotationLayer extends tf.layers.Layer {
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

tf.serialization.registerClass(RandomRotationLayer)
