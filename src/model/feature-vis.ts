import * as tf from "@tensorflow/tfjs"

// Feature visualization by activation maximization: generates the input that excites a single neuron the most

export interface ReceptiveField {
  y: number
  x: number
  height: number
  width: number
}

export interface FeatureVis {
  data: Float32Array // generated input in [0, 1], shape [height, width, channels]
  shape: [number, number, number]
  receptiveField: ReceptiveField // the part of the input that the neuron can see
}

export interface FeatureVisOptions {
  steps?: number
  learningRate?: number
  tvWeight?: number // total variation penalty: suppresses high-frequency noise
  l2Weight?: number // pulls pixels without influence back to gray
  jitter?: number // max. random shift in px per step, for patterns that are robust to small translations
  inputRange?: [number, number] // value range of the model input, see imageInputRanges
  sliceMs?: number
  shouldAbort?: () => boolean
  onProgress?: (featureVis: FeatureVis, progress: number) => void // progress: 0..1
  progressEvery?: number // steps
}

export function supportsFeatureVis(model: tf.LayersModel, tfLayer: tf.layers.Layer) {
  if (model.inputs.length !== 1) return false
  const [, height, width, channels] = model.inputs[0].shape
  if (!height || !width || (channels !== 1 && channels !== 3)) return false
  if (model.inputs[0].shape.length !== 4) return false
  return hasWeightedInput(tfLayer)
}

// layers where the weighted input of a single neuron can be computed, see getWeightedInput
export function hasWeightedInput(tfLayer: tf.layers.Layer) {
  const className = tfLayer.getClassName()
  if (className === "Conv2D") return tfLayer.getConfig().dataFormat !== "channelsFirst"
  if (className === "Dense") return getLayerInput(tfLayer).shape.length === 2
  return false
}

/**
 * Gradient ascent on the input pixels, starting from gray. The objective is the weighted input of the neuron
 * (before the activation function): a ReLU neuron that is not active has no gradient to start with, and for
 * a softmax output the probability could also be raised by just suppressing the other classes.
 * The image is parametrized as sigmoid(z), so that it stays in [0, 1] and is scaled to the input range of the model.
 * Yields to the main thread every ~sliceMs. Returns undefined if aborted or not supported.
 */
export async function maximizeActivation(
  model: tf.LayersModel,
  tfLayer: tf.layers.Layer,
  neuronIdx: number,
  {
    steps = 200,
    learningRate = 0.1,
    tvWeight = 2,
    l2Weight = 0.3,
    jitter = 1,
    inputRange = [0, 1],
    sliceMs = 8,
    shouldAbort,
    onProgress,
    progressEvery = 25,
  }: FeatureVisOptions = {},
): Promise<FeatureVis | undefined> {
  if (!supportsFeatureVis(model, tfLayer)) return
  const shape = model.inputs[0].shape.slice(1) as [number, number, number]
  const [height, width] = shape
  const receptiveField = getReceptiveField(tfLayer, neuronIdx, shape)
  // small receptive fields (e.g. 3x3 in the first layer) are high-frequency by nature: shifting and smoothing
  // would wash them out
  const regularize = Math.min(receptiveField.height, receptiveField.width) > 8

  const layerInput = getLayerInput(tfLayer)
  const isFirstLayer = layerInput.sourceLayer.getClassName() === "InputLayer"
  const head = isFirstLayer ? undefined : tf.model({ inputs: model.inputs, outputs: layerInput })
  const filter = tf.keep(getFilter(tfLayer, neuronIdx))
  const objective = (x: tf.Tensor) => getWeightedInput(tfLayer, neuronIdx, filter, x).sum()

  const z = tf.tidy(() => tf.variable(tf.randomNormal([1, ...shape], 0, 0.01)))
  const optimizer = tf.train.adam(learningRate)
  const [min, max] = inputRange
  const forward = (img: tf.Tensor) => {
    const x = min === 0 && max === 1 ? img : img.mul(max - min).add(min)
    return objective(head ? (head.apply(x) as tf.Tensor) : x)
  }
  // the size of the gradients differs a lot between models (e.g. BatchNormalization or not): the objective
  // is scaled by its initial gradient (RMS inside the receptive field), so that the penalties weigh the same
  const scale = tf.tidy(() => {
    const grad = tf.grad(forward)(z.sigmoid())
    const numNonZero = grad.notEqual(0).sum().maximum(1)
    const rms = grad.square().sum().div(numNonZero).sqrt().dataSync()[0]
    return rms > 0 ? 1 / rms : 1
  })
  const getResult = async (): Promise<FeatureVis> => {
    const img = tf.tidy(() => z.sigmoid())
    try {
      return { data: (await img.data()) as Float32Array, shape, receptiveField }
    } finally {
      img.dispose()
    }
  }

  try {
    let sliceStart = performance.now()
    for (let step = 0; step < steps; step++) {
      if (performance.now() - sliceStart > sliceMs) {
        await yieldToMain()
        if (shouldAbort?.()) return
        sliceStart = performance.now()
      }
      optimizer.minimize(
        () => {
          const img = z.sigmoid() as tf.Tensor4D
          const shifted = regularize && jitter ? shift(img, jitter) : img
          const value = forward(shifted)
          if (!regularize) return value.neg() as tf.Scalar
          const penalty = totalVariation(img)
            .mul(tvWeight)
            .add(img.sub(0.5).square().mean().mul(l2Weight))
          // penalties are relative to the image size, the objective is a single value
          return value.mul(-scale).add(penalty.mul(height * width)) as tf.Scalar
        },
        false,
        [z],
      )
      if (onProgress && step > 0 && step % progressEvery === 0) {
        onProgress(await getResult(), step / steps)
        if (shouldAbort?.()) return
      }
    }
    return await getResult()
  } finally {
    tf.dispose([z, filter])
    optimizer.dispose()
  }
}

// last inbound node as in getSingleOutput
export function getLayerInput(tfLayer: tf.layers.Layer) {
  const input = tfLayer.getInputAt(tfLayer.inboundNodes.length - 1)
  return Array.isArray(input) ? input[0] : input
}

// the weights of this neuron only: Conv2D [kernelHeight, kernelWidth, inChannels, 1], Dense [inputs, 1]
export function getFilter(tfLayer: tf.layers.Layer, neuronIdx: number) {
  const [kernel] = tfLayer.getWeights()
  const numFilters = kernel.shape[kernel.shape.length - 1]
  const filterIdx = neuronIdx % numFilters
  return tfLayer.getClassName() === "Conv2D"
    ? kernel.slice([0, 0, 0, filterIdx], [-1, -1, -1, 1])
    : kernel.slice([0, filterIdx], [-1, 1])
}

// weighted input of the neuron for each sample in x (= input of the layer), without bias (constant): [batch]
export function getWeightedInput(
  tfLayer: tf.layers.Layer,
  neuronIdx: number,
  filter: tf.Tensor,
  x: tf.Tensor,
) {
  if (tfLayer.getClassName() === "Dense") return tf.matMul(x, filter).reshape([-1])
  const { strides, padding, dilationRate } = tfLayer.getConfig()
  const [, , outWidth, numFilters] = tfLayer.outputShape as number[]
  const pos = Math.floor(neuronIdx / numFilters)
  const [row, col] = [Math.floor(pos / outWidth), pos % outWidth]
  return tf
    .conv2d(
      x as tf.Tensor4D,
      filter as tf.Tensor4D,
      strides as [number, number],
      padding as "same" | "valid",
      "NHWC",
      dilationRate as [number, number],
    )
    .slice([0, row, col, 0], [-1, 1, 1, 1])
    .reshape([-1])
}

// random translation by up to maxShift px in each direction, filled with gray
function shift(img: tf.Tensor4D, maxShift: number) {
  const [, height, width] = img.shape
  const offset = () => Math.floor(Math.random() * (2 * maxShift + 1))
  const padded = img.pad(
    [
      [0, 0],
      [maxShift, maxShift],
      [maxShift, maxShift],
      [0, 0],
    ],
    0.5,
  )
  return padded.slice([0, offset(), offset(), 0], [-1, height, width, -1])
}

// mean squared difference of neighboring pixels
function totalVariation(img: tf.Tensor4D) {
  const [, height, width] = img.shape
  const dy = img.slice([0, 1, 0, 0]).sub(img.slice([0, 0, 0, 0], [-1, height - 1, -1, -1]))
  const dx = img.slice([0, 0, 1, 0]).sub(img.slice([0, 0, 0, 0], [-1, -1, width - 1, -1]))
  return dy.square().mean().add(dx.square().mean())
}

const POINTWISE_LAYERS = [
  "BatchNormalization",
  "Dropout",
  "SpatialDropout2D",
  "Activation",
  "ReLU",
  "LeakyReLU",
]

/**
 * Receptive field of a neuron in the input image, for a plain chain of Conv/Pooling layers. Everything else
 * (Dense, branches, unknown layers) falls back to the full image.
 */
export function getReceptiveField(
  tfLayer: tf.layers.Layer,
  neuronIdx: number,
  [height, width]: number[],
): ReceptiveField {
  const full = { y: 0, x: 0, height, width }
  const chain = getLayerChain(tfLayer)
  if (!chain || tfLayer.outputShape.length !== 4) return full
  // per axis [y, x]: input coordinate of the first pixel seen by output index 0, size, distance between outputs
  const start = [0, 0]
  const size = [1, 1]
  const jump = [1, 1]
  for (const layer of chain) {
    const className = layer.getClassName()
    if (POINTWISE_LAYERS.includes(className)) continue
    const config = layer.getConfig()
    if (config.dataFormat === "channelsFirst") return full
    const inShape = getLayerInput(layer).shape as number[]
    const kernel = toPair(config.kernelSize ?? config.poolSize)
    if (
      !kernel ||
      !["Conv2D", "DepthwiseConv2D", "MaxPooling2D", "AveragePooling2D"].includes(className)
    )
      return full
    const strides = toPair(config.strides) ?? kernel
    const dilation = toPair(config.dilationRate) ?? [1, 1]
    for (const axis of [0, 1]) {
      const kernelSize = (kernel[axis] - 1) * dilation[axis] + 1
      const inSize = inShape[axis + 1]
      const outSize = Math.ceil(inSize / strides[axis])
      const padTotal =
        config.padding === "same"
          ? Math.max((outSize - 1) * strides[axis] + kernelSize - inSize, 0)
          : 0
      start[axis] -= Math.floor(padTotal / 2) * jump[axis]
      size[axis] += (kernelSize - 1) * jump[axis]
      jump[axis] *= strides[axis]
    }
  }
  const [, , outWidth, numFilters] = tfLayer.outputShape as number[]
  const pos = Math.floor(neuronIdx / numFilters)
  const idx = [Math.floor(pos / outWidth), pos % outWidth]
  const [y, x] = [0, 1].map((axis) => Math.max(start[axis] + idx[axis] * jump[axis], 0))
  const yEnd = Math.min(start[0] + idx[0] * jump[0] + size[0], height)
  const xEnd = Math.min(start[1] + idx[1] * jump[1] + size[1], width)
  return { y, x, height: yEnd - y, width: xEnd - x }
}

// layers from the first layer after the input up to tfLayer, undefined if there are branches
function getLayerChain(tfLayer: tf.layers.Layer) {
  const chain: tf.layers.Layer[] = []
  let layer = tfLayer
  while (layer.getClassName() !== "InputLayer") {
    chain.unshift(layer)
    const node = layer.inboundNodes[layer.inboundNodes.length - 1]
    if (node?.inboundLayers.length !== 1) return
    layer = node.inboundLayers[0]
  }
  return chain
}

function toPair(value: unknown) {
  if (typeof value === "number") return [value, value]
  if (Array.isArray(value) && value.length === 2) return value as number[]
}

// a macrotask, so that the browser can render a frame and handle input in between
function yieldToMain() {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler
  if (scheduler?.yield) return scheduler.yield()
  return new Promise<void>((resolve) => setTimeout(resolve, 0))
}
