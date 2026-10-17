import * as tf from "@tensorflow/tfjs"
import { Layer, type LayerArgs } from "@tensorflow/tfjs-layers/dist/engine/topology"
import { getActivation, serializeActivation } from "@tensorflow/tfjs-layers/dist/activations"
import type { Activation } from "@tensorflow/tfjs-layers/dist/activations"
import type { ActivationIdentifier } from "@tensorflow/tfjs-layers/dist/keras_format/activation_config"
import type { LayerVariable } from "@tensorflow/tfjs-layers/dist/variables"
import { getNid } from "@/neuron-layers/helpers"
import type { GetInputNidsFunc, LayerDef } from "./types"

// a convolution over the steps of a sequence [batch, steps, channels], separately for each channel (filter
// [kernelSize] per channel), e.g. LFM2's short convolutions (after ZeroPadding1D: causal, see ml-notebooks/lfm2.py)
// reference: https://github.com/keras-team/keras/blob/v3.15.1/keras/src/layers/convolutional/depthwise_conv1d.py

// each neuron is connected to its own channel at kernelSize consecutive positions of the previous layer.
// The previous visible layer may be the unpadded input (ZeroPadding1D is invisible): the positions are aligned
// at the end, e.g. causal padding [kernelSize - 1, 0]: the positions t - kernelSize + 1 .. t
export const getConv1DInputNids: GetInputNidsFunc = (l, nIdx, prevLayer, prevLayerIdx) => {
  const [, steps, channels] = l.outputShape as number[]
  const [, prevSteps, prevChannels] = prevLayer.outputShape as number[]
  const kernelSize = (l as DepthwiseConv1DLayer).kernelSize
  const [position, channel] = [Math.floor(nIdx / channels), nIdx % channels]
  const inputChannel = Math.floor(channel / (channels / prevChannels)) // depthMultiplier outputs per input
  const start = position + prevSteps - (steps + kernelSize - 1) // valid convolution: prevSteps = steps + k - 1
  const nids = []
  for (let p = Math.max(start, 0); p < Math.min(start + kernelSize, prevSteps); p++) {
    nids.push(getNid(prevLayerIdx, p * prevChannels + inputChannel))
  }
  return nids
}

export const DepthwiseConv1D: LayerDef<"DepthwiseConv1D"> = {
  constructorFunc: (args) => new DepthwiseConv1DLayer(args),
  getInputNids: getConv1DInputNids,
}

export interface DepthwiseConv1DLayerArgs extends LayerArgs {
  kernelSize: number | [number]
  depthMultiplier?: number
  strides?: number | [number] // only 1
  dilationRate?: number | [number] // only 1
  padding?: "valid"
  activation?: ActivationIdentifier
  useBias?: boolean
}

const single = (value: number | number[] | undefined, fallback: number) =>
  Array.isArray(value) ? value[0] : (value ?? fallback)

// Layer from the ESM files of tfjs-layers, see multi-head-attention.ts
class DepthwiseConv1DLayer extends Layer {
  static className = "DepthwiseConv1D"
  readonly kernelSize: number
  private depthMultiplier: number
  private activation: Activation
  private useBias: boolean
  private kernel!: LayerVariable // [kernelSize, channels, depthMultiplier] as in Keras
  private bias?: LayerVariable // [channels * depthMultiplier]

  constructor(args: DepthwiseConv1DLayerArgs) {
    super(args)
    const [strides, dilationRate] = [single(args.strides, 1), single(args.dilationRate, 1)]
    if (strides !== 1 || dilationRate !== 1 || (args.padding ?? "valid") !== "valid") {
      throw new Error(
        "DepthwiseConv1D: only strides 1, dilation_rate 1 and padding 'valid' (use ZeroPadding1D)",
      )
    }
    this.kernelSize = single(args.kernelSize, 1)
    this.depthMultiplier = args.depthMultiplier ?? 1
    this.activation = getActivation(args.activation ?? "linear")
    this.useBias = args.useBias ?? true
  }

  override build(inputShape: tf.Shape | tf.Shape[]): void {
    const shape = (Array.isArray(inputShape[0]) ? inputShape[0] : inputShape) as tf.Shape
    const channels = shape[shape.length - 1] as number
    const kernelShape = [this.kernelSize, channels, this.depthMultiplier]
    this.kernel = this.addWeight(
      "depthwise_kernel",
      kernelShape,
      "float32",
      tf.initializers.glorotUniform({}),
    )
    if (this.useBias) {
      const biasShape = [channels * this.depthMultiplier]
      this.bias = this.addWeight("bias", biasShape, "float32", tf.initializers.zeros())
    }
    this.built = true
  }

  override computeOutputShape(inputShape: tf.Shape | tf.Shape[]): tf.Shape {
    const [batch, steps, channels] = (
      Array.isArray(inputShape[0]) ? inputShape[0] : inputShape
    ) as tf.Shape
    const outSteps = steps === null ? null : steps - this.kernelSize + 1
    return [batch, outSteps, (channels as number) * this.depthMultiplier]
  }

  override call(inputs: tf.Tensor | tf.Tensor[]): tf.Tensor {
    return tf.tidy(() => {
      const x = (Array.isArray(inputs) ? inputs[0] : inputs) as tf.Tensor3D
      const [, , channels] = x.shape
      // as a depthwise 2D convolution with height 1: [batch, 1, steps, channels]
      const filter = this.kernel
        .read()
        .reshape([1, this.kernelSize, channels, this.depthMultiplier])
      let y = tf.depthwiseConv2d(x.expandDims(1) as tf.Tensor4D, filter as tf.Tensor4D, 1, "valid")
      if (this.bias) y = y.add(this.bias.read())
      return this.activation.apply(y.squeeze([1]))
    })
  }

  override getConfig(): tf.serialization.ConfigDict {
    const config = {
      kernelSize: [this.kernelSize],
      depthMultiplier: this.depthMultiplier,
      strides: [1],
      dilationRate: [1],
      padding: "valid",
      activation: serializeActivation(this.activation),
      useBias: this.useBias,
    }
    return { ...super.getConfig(), ...config }
  }
}

tf.serialization.registerClass(DepthwiseConv1DLayer)
