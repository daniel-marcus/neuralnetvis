/**
 * Endless feed-forward network for the cover: every neuron is connected to its nearest neurons in the next layer.
 * Only a part of the input changes with every sample. A neuron that has changed sends signals to the next layer,
 * and a neuron only changes when such a signal arrives: so the changes run through the network as cascades.
 */

export interface NetworkConfig {
  layers: number
  neurons: number // per layer
  fan: number // every neuron is connected to the 2 * fan + 1 nearest neurons of the next layer
  sampleInterval: number // seconds between two samples
  signalDuration: number // seconds for a signal to reach the next layer
  random?: () => number
}

export interface Layer {
  values: Float32Array // activations between -1 and 1
  prevValues: Float32Array // before the last change
  changedAt: Float32Array // time of the last change
  // connections to the next layer: (2 * fan + 1) per neuron
  weights: Float32Array
  signals: Float32Array // last signal per connection: weighted change of the activation
  sentAt: Float32Array
}

interface Pass {
  layer: Layer // reached last
  changed: number[] // neurons that have changed in that layer
  arrivesAt: number // in the next layer
}

const INPUT_SLOT = 1 // just in front of the camera
const INPUT_CHANGE_RATE = 0.2 // share of the input neurons that change with a new sample
const INPUT_SPARSITY = 0.6 // share of inactive input neurons
const WEIGHT_RANGE = [-0.7, 1] // more excitatory than inhibitory connections
// activation function: tuned for a stable share of ~35% active neurons in all layers
const GAIN = 4
const INHIBITION = 1.2 // by the activity of the inputs, otherwise the activity would saturate
const THRESHOLD = 0.1
const MIN_CHANGE = 0.07 // smaller changes are not passed on
const NEVER = -1e6
const MAX_CATCH_UP = 2 // seconds, e.g. after the tab was hidden

export type Network = ReturnType<typeof createNetwork>

export function createNetwork(config: NetworkConfig) {
  const { neurons, fan, sampleInterval, signalDuration, random = Math.random } = config
  const fanSize = 2 * fan + 1
  const layers: Layer[] = [] // 0 is the nearest
  let passes: Pass[] = []
  let nextSampleAt = 0

  function newLayer(): Layer {
    const weights = new Float32Array(neurons * fanSize)
    for (let from = 0; from < neurons; from++) {
      for (let c = 0; c < fanSize; c++) {
        const to = from - fan + c
        if (to < 0 || to >= neurons) continue // no connection
        weights[from * fanSize + c] =
          WEIGHT_RANGE[0] + random() * (WEIGHT_RANGE[1] - WEIGHT_RANGE[0])
      }
    }
    return {
      values: new Float32Array(neurons),
      prevValues: new Float32Array(neurons),
      changedAt: new Float32Array(neurons).fill(NEVER),
      weights,
      signals: new Float32Array(neurons * fanSize),
      sentAt: new Float32Array(neurons * fanSize).fill(NEVER),
    }
  }

  function getActivation(src: Layer, to: number) {
    let sum = 0
    let activity = 0
    for (let c = 0; c < fanSize; c++) {
      const from = to + fan - c
      if (from < 0 || from >= neurons) continue
      sum += src.weights[from * fanSize + c] * src.values[from]
      activity += Math.abs(src.values[from])
    }
    const x = Math.abs(sum) * GAIN - activity * INHIBITION
    return x < THRESHOLD ? 0 : Math.sign(sum) * Math.min(1, (x - THRESHOLD) / (1 - THRESHOLD))
  }

  function setValue(layer: Layer, idx: number, value: number, time: number) {
    layer.prevValues[idx] = layer.values[idx]
    layer.values[idx] = value
    layer.changedAt[idx] = time
  }

  function sendSignals(layer: Layer, changed: number[], time: number) {
    for (const from of changed) {
      const delta = layer.values[from] - layer.prevValues[from]
      for (let c = 0; c < fanSize; c++) {
        const i = from * fanSize + c
        layer.signals[i] = layer.weights[i] * delta
        layer.sentAt[i] = time
      }
    }
    if (changed.length) passes.push({ layer, changed, arrivesAt: time + signalDuration })
  }

  // without signals: for layers that are not visible (yet)
  function setAll(src: Layer, dst: Layer) {
    for (let i = 0; i < neurons; i++) dst.values[i] = dst.prevValues[i] = getActivation(src, i)
  }

  function newSample(time: number) {
    const layer = layers[INPUT_SLOT]
    const changed: number[] = []
    for (let i = 0; i < neurons; i++) {
      if (random() >= INPUT_CHANGE_RATE) continue
      const value = random() < INPUT_SPARSITY ? 0 : random() * 2 - 1
      if (Math.abs(value - layer.values[i]) < MIN_CHANGE) continue
      setValue(layer, i, value, time)
      changed.push(i)
    }
    sendSignals(layer, changed, time)
  }

  function arrive({ layer: src, changed: srcChanged, arrivesAt: time }: Pass) {
    const dst = layers[layers.indexOf(src) + 1] as Layer | undefined
    if (!dst || !layers.includes(src)) return // behind the last layer or the camera
    const targets = new Set<number>()
    for (const from of srcChanged) {
      for (let to = Math.max(0, from - fan); to <= Math.min(neurons - 1, from + fan); to++) {
        targets.add(to)
      }
    }
    const changed: number[] = []
    for (const to of targets) {
      const value = getActivation(src, to)
      if (Math.abs(value - dst.values[to]) < MIN_CHANGE) continue
      setValue(dst, to, value, time)
      changed.push(to)
    }
    sendSignals(dst, changed, time)
  }

  // initial state: as after a full forward pass of a random sample
  for (let slot = 0; slot < config.layers; slot++) {
    const layer = newLayer()
    if (slot === 0) {
      layer.values.forEach((_, i) => {
        layer.values[i] = layer.prevValues[i] = random() < INPUT_SPARSITY ? 0 : random() * 2 - 1
      })
    } else setAll(layers[slot - 1], layer)
    layers.push(layer)
  }

  return {
    layers,
    fanSize,
    // the nearest layer has passed the camera, a new one is added at the far end
    shift() {
      layers.shift()
      const layer = newLayer()
      setAll(layers.at(-1)!, layer)
      layers.push(layer)
    },
    // processes all events until the given time, returns true if something has changed
    update(time: number) {
      if (time - nextSampleAt > MAX_CATCH_UP) nextSampleAt = time
      let hasChanged = false
      while (true) {
        const pass = passes.reduce<Pass | undefined>(
          (first, p) => (!first || p.arrivesAt < first.arrivesAt ? p : first),
          undefined,
        )
        const isSampleNext = !pass || nextSampleAt <= pass.arrivesAt
        if ((isSampleNext ? nextSampleAt : pass.arrivesAt) > time) break
        if (isSampleNext) {
          newSample(nextSampleAt)
          nextSampleAt += sampleInterval
        } else {
          passes = passes.filter((p) => p !== pass)
          arrive(pass)
        }
        hasChanged = true
      }
      return hasChanged
    },
  }
}
