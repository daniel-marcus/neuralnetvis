import * as tf from "@tensorflow/tfjs"

export function getSingleOutput(tfLayer: tf.layers.Layer) {
  // last inbound node; normally this is just 0, but in cases of nested models (e.g. Sequential as a layer) it is 1
  // ReversibleEmbedding: 1st call (embeddings), the 2nd call (logits) is visualized by the softmax output layer
  const nodeIdx =
    tfLayer.getClassName() === "ReversibleEmbedding" ? 0 : tfLayer.inboundNodes.length - 1
  const result = tfLayer.getOutputAt(nodeIdx)
  return Array.isArray(result) ? result[0] : result
}

type Shape = (number | null)[]

function checkShapeMatch(s1: Shape, s2: Shape) {
  return s1.every((value, idx) => value === s2[idx])
}

export function getLayerActivations(
  model: tf.LayersModel,
  inputTensor: tf.Tensor,
  outputs?: tf.SymbolicTensor[],
) {
  const inputDimsModel = model.layers[0].batchInputShape.slice(1)
  const inputDimsSample = inputTensor.shape.slice(1)
  if (!checkShapeMatch(inputDimsModel, inputDimsSample)) return
  try {
    return tf.tidy(() => {
      const tmpModel = tf.model({
        inputs: model.input,
        outputs: outputs ?? model.layers.map(getSingleOutput),
      })
      const result = tmpModel.predict(inputTensor)
      return Array.isArray(result) ? result : [result]
    })
  } catch {
    return
  }
}

/**
 * Like getLayerActivations, but yields to the main thread every ~sliceMs during the forward pass, so that
 * rendering and input handling continue. The kernels are dispatched synchronously by JS (WebGPU: ~0.1ms
 * each), e.g. ~800 kernels = ~90ms for TinyStories-3M in a single predict() call.
 * Runs the layers in topological order like tfjs' execute() in predict(). Returns undefined if aborted.
 */
export async function getLayerActivationsAsync(
  model: tf.LayersModel,
  inputTensor: tf.Tensor,
  outputs: tf.SymbolicTensor[],
  { shouldAbort, sliceMs = 8 }: { shouldAbort?: () => boolean; sliceMs?: number } = {},
): Promise<tf.Tensor[] | undefined> {
  const inputDimsModel = model.layers[0].batchInputShape.slice(1)
  if (!checkShapeMatch(inputDimsModel, inputTensor.shape.slice(1))) return
  const sorted = getExecutionOrder(outputs)
  // Keras masking (e.g. Embedding with mask_zero) isn't handled here, use predict()
  const usesMasking = sorted.some((t) => t.sourceLayer.getConfig().maskZero)
  if (model.inputs.length !== 1 || usesMasking)
    return getLayerActivations(model, inputTensor, outputs)

  // own reference to the input data: the caller may dispose inputTensor while this is running (new sample)
  const input = tf.clone(inputTensor)
  const values = new Map<tf.SymbolicTensor, tf.Tensor>([[model.inputs[0], input]])
  let result: tf.Tensor[] | undefined
  try {
    let sliceStart = performance.now()
    for (const symbolic of sorted) {
      if (values.has(symbolic)) continue // model input or another output of a node that already ran
      if (performance.now() - sliceStart > sliceMs) {
        await yieldToMain()
        if (shouldAbort?.()) return
        sliceStart = performance.now()
      }
      const inputs = symbolic.inputs.map((t) => values.get(t)!)
      const node = symbolic.sourceLayer.inboundNodes[symbolic.nodeIndex]
      const nodeOutputs = tf.tidy(() => toList(symbolic.sourceLayer.apply(inputs) as tf.Tensor))
      node.outputTensors.forEach((t, i) => values.set(t, nodeOutputs[i]))
    }
    result = outputs.map((t) => values.get(t)!)
    return result
  } finally {
    // intermediate tensors (and the input) that are not part of the result
    const keep = new Set<tf.Tensor>(result)
    tf.dispose([...values.values()].filter((t) => !keep.has(t)))
  }
}

// SymbolicTensors in topological order: each one after the inputs of the node that computes it
function getExecutionOrder(outputs: tf.SymbolicTensor[]) {
  const sorted: tf.SymbolicTensor[] = []
  const visited = new Set<tf.SymbolicTensor>()
  const visit = (t: tf.SymbolicTensor) => {
    if (visited.has(t)) return
    visited.add(t)
    t.inputs?.forEach(visit)
    sorted.push(t)
  }
  outputs.forEach(visit)
  return sorted
}

const toList = <T>(x: T | T[]) => (Array.isArray(x) ? x : [x])

// a macrotask, so that the browser can render a frame and handle input in between
function yieldToMain() {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler
  if (scheduler?.yield) return scheduler.yield()
  return new Promise<void>((resolve) => setTimeout(resolve, 0))
}
