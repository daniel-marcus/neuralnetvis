import * as hdf5 from "jsfive"
import * as tf from "@tensorflow/tfjs"
import JSZip from "jszip"
import { isDebug } from "@/store"

// experimental import for .keras files from Keras 3

const multiHeadAttentionPathNames = ["query_dense", "key_dense", "value_dense", "output_dense"]

export async function importKerasModel(file: File) {
  if (isDebug()) console.log("Importing keras model file:", file)
  try {
    const zipBuffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(zipBuffer)

    // 1. Create the model from the JSON config

    const modelFile = zip.files["config.json"]
    const modelBuffer = await modelFile.async("string")
    const modelJson = JSON.parse(modelBuffer)
    const parsedModelJson = adaptReversibleEmbedding(parseModelObject(modelJson))
    if (isDebug()) console.log("Model JSON:", { modelJson, parsedModelJson })
    const model = await tf.models.modelFromJSON(parsedModelJson)
    if (isDebug()) console.log("Created model from JSON:", model)

    // 2. Assign the weights from the HDF5 file

    const weightsFile = zip.files["model.weights.h5"]
    const weightsBuffer = await weightsFile.async("arraybuffer")
    const f = new hdf5.File(weightsBuffer)

    const classCounter = new Map<string, number>()
    for (const layer of model.layers) {
      const className = camelCaseToSnakeCase(layer.getClassName())
      const count = classCounter.get(className) || 0
      classCounter.set(className, count + 1)
      const layerPath = count === 0 ? className : `${className}_${count}`
      if (isDebug()) console.log(">> LAYER", layerPath)

      const sublayerCounter = new Map<string, number>()
      for (const [i, _weight] of layer.getWeights().entries()) {
        const weight = _weight as tf.Variable

        // 1. Determine the path for the weight
        let weightPath = `/vars/${i}`
        if (className === "multi_head_attention") {
          const sublayerIdx = Math.floor(i / 2) // 2 weights per sublayer
          const sublayerName = multiHeadAttentionPathNames[sublayerIdx] // query_dense, key_dense, value_dense, output_dense
          weightPath = `/${sublayerName}/vars/${i % 2}` // 0 or 1 for kernel / bias
        } else if (className === "sequential") {
          const weightLayerVar = layer.weights[i]
          const sublayerName = weightLayerVar.originalName.split("/")[0] // e.g. "dense_1"
          const weightCount = sublayerCounter.get(sublayerName) || 0
          sublayerCounter.set(sublayerName, weightCount + 1)
          weightPath = `/layers/${sublayerName}/vars/${weightCount}`
        }
        const path = `layers/${layerPath}` + weightPath
        if (isDebug()) console.log(i, path, weight)

        // 2. Assign the weight from the HDF5 file
        try {
          const hdf5Data = f.get(path)?.value
          weight.assign(tf.tensor(hdf5Data, weight.shape as number[], weight.dtype))
        } catch (error) {
          console.error(`Error loading weight from path: ${path}`, error)
          continue
        }
      }
    }
    return model
  } catch (error) {
    console.error("Error importing keras model:", error)
  }
}

export function parseModelObject<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => parseModelObject(item)) as T
  } else if (obj !== null && typeof obj === "object") {
    return Object.entries(obj).reduce(
      (acc, [key, value]) => {
        const parsedKey = parseKey(key)
        let parsedValue = parseModelObject(value)

        // parse inbound_nodes to legacy format, one entry per call of the layer (shared layers have several)
        if (key === "inbound_nodes" && Array.isArray(value) && value.length > 0) {
          parsedValue = value.map((call: NewCall) => {
            const nodes = (
              Array.isArray(call.args[0]) ? call.args[0] : call.args
            ) as NewInboundNode[]
            const kwargs = parseCallKwargs(call.kwargs)
            return nodes
              .map((node) => parseInboundNode(node, kwargs))
              .filter(Boolean) as LegacyInboundNode[]
          })
        } else if (
          /*
        MultiHeadAttention: build_config.shapes_dict -> config
        Keras 3 exports a build_config object with shapes_dict, but tfjs expects the shapes to be directly in the config
        Example:
        "build_config": {
          "shapes_dict": {
            "query_shape": [null, 200, 32],
            "value_shape": [null, 200, 32]
          }
        }
        */
          key === "build_config" &&
          typeof value === "object" &&
          "shapes_dict" in value &&
          typeof acc.config === "object" &&
          acc.config !== null
        ) {
          const shapesDict = value.shapes_dict as Record<string, unknown> // {query_shape, value_shape, key_shape}
          acc.config = {
            ...acc.config,
            ...shapesDict,
          }
        } else if (["input_layers", "output_layers"].includes(key)) {
          // ["input_layer", 0, 0] -> [["input_layer", 0, 0]]
          if (Array.isArray(value) && value.length > 0 && !Array.isArray(value[0])) {
            parsedValue = [[...value]]
          }
        }
        // return [parsedKey, parsedValue]
        acc[parsedKey] = parsedValue
        return acc
      },
      {} as Record<string, unknown>,
    ) as T
  } else return obj
}

function parseKey(str: string) {
  // "batch_shape" -> "batch_input_shape"
  return str.replace("batch_shape", "batch_input_shape")
}

type NewCall = {
  args: NewInboundNode[] | [NewInboundNode[]]
  kwargs?: Record<string, unknown>
}

type NewInboundNode = {
  class_name: string
  config: {
    shape: (number | null)[]
    dtype: string
    keras_history: [string, number, number]
  }
}
// Legacy inbound node format: [layerName, nodeIdx = 0, tensorIdx = 0, args = {}]
type LegacyInboundNode = [string, number, number, Record<string, unknown>]

// Keras 3 call kwargs that are passed on to the tfjs layers (e.g. mha(x, x, use_causal_mask=True)),
// tfjs converts them to camelCase. Others are dropped: Dropout's {"training": false} would disable
// dropout when training in the browser.
const supportedCallKwargs = ["use_causal_mask"]

function parseCallKwargs(kwargs: Record<string, unknown> = {}): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(kwargs).filter(([key]) => supportedCallKwargs.includes(key)),
  )
}

function parseInboundNode(
  node: NewInboundNode,
  kwargs: Record<string, unknown> = {},
): LegacyInboundNode | undefined {
  if (typeof node !== "object" || node === null) {
    console.warn("Unknown inbound node format:", node)
    return
  }
  const [inboundLayerName, kerasNodeIdx] = node.config.keras_history
  const nodeIdx = inboundLayerName.startsWith("sequential") ? 1 : kerasNodeIdx // TODO: find a better way to determine the nodeIdx of nested models
  return [inboundLayerName, nodeIdx, 0, kwargs] // tfjs reads the kwargs from the node's last input
}

type ParsedLayer = {
  class_name: string
  name: string
  config: Record<string, unknown>
  inbound_nodes: LegacyInboundNode[][]
}
type ParsedModel = {
  config: {
    layers: ParsedLayer[]
    output_layers: [string, number, number][]
  }
}

/*
Models with tied input / output embeddings (keras.layers.ReversibleEmbedding, 2nd call with reverse=True):
- the model outputs logits, but neuralnetvis expects probabilities (loss, next word suggestions): add a softmax layer
- trained with variable sequence length (input shape [null, null]): use the length of the PositionEmbedding
*/
export function adaptReversibleEmbedding<T>(modelJson: T): T {
  const model = modelJson as ParsedModel
  const layers = model.config?.layers
  if (!layers?.some((l) => l.class_name === "ReversibleEmbedding")) return modelJson

  const seqLen = layers.find((l) => l.class_name === "PositionEmbedding")?.config.sequence_length
  for (const layer of layers) {
    const shape = layer.config.batch_input_shape
    if (layer.class_name !== "InputLayer" || !Array.isArray(shape)) continue
    if (shape.length === 2 && shape[1] === null && typeof seqLen === "number") shape[1] = seqLen
  }

  const outputs = model.config.output_layers
  const [outputName, nodeIdx, tensorIdx] = outputs[0] ?? []
  const outputLayer = layers.find((l) => l.name === outputName)
  if (outputs.length !== 1 || outputLayer?.class_name !== "ReversibleEmbedding") return modelJson
  const name = "softmax"
  layers.push({
    class_name: "Activation",
    name,
    config: { name, activation: "softmax", trainable: true },
    inbound_nodes: [[[outputName, nodeIdx, tensorIdx, {}]]],
  })
  model.config.output_layers = [[name, 0, 0]]
  return modelJson
}

function camelCaseToSnakeCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase()
}
