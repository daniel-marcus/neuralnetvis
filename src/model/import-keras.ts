import * as hdf5 from "jsfive"
import * as tf from "@tensorflow/tfjs"
import JSZip from "jszip"
import { isDebug } from "@/store"

// experimantal import for .keras files from Keras 3

const multiHeadAttentionPathNames = [
  "query_dense",
  "key_dense",
  "value_dense",
  "output_dense",
]

export async function importKerasModel(file: File) {
  if (isDebug()) console.log("Importing keras model file:", file)
  try {
    const zipBuffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(zipBuffer)

    const modelFile = zip.files["config.json"]

    const modelBuffer = await modelFile.async("string")
    const modelJson = JSON.parse(modelBuffer)
    const parsedModelJson = parseModelObject(modelJson)
    if (isDebug()) console.log("Parsed model JSON:", parsedModelJson)

    const model = await tf.models.modelFromJSON(parsedModelJson)
    if (isDebug()) console.log("Created model from JSON:", model)

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
      for (const [i, _weight] of layer.getWeights().entries()) {
        const weight = _weight as tf.Variable

        let weightPath = `/vars/${i}`
        if (className === "multi_head_attention") {
          const sublayerIdx = Math.floor(i / 2) // 2 weights per sublayer
          const sublayerName = multiHeadAttentionPathNames[sublayerIdx] // query_dense, key_dense, value_dense, output_dense
          weightPath = `/${sublayerName}/vars/${i % 2}` // 0 or 1 for kernel / bias
        }
        const path = `layers/${layerPath}` + weightPath

        const hdf5Data = f.get(path)?.value
        if (isDebug()) console.log(i, path, weight, hdf5Data)
        if (!hdf5Data) {
          console.warn(`No data found for path: ${path}`)
          continue
        }
        weight.assign(
          tf.tensor(hdf5Data, weight.shape as number[], weight.dtype)
        )
      }
    }
    return model
  } catch (error) {
    console.error("Error importing keras model:", error)
  }
}

function parseModelObject<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => parseModelObject(item)) as T
  } else if (obj !== null && typeof obj === "object") {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      const parsedKey = parseKey(key)
      let parsedValue = parseModelObject(value)

      // parse inbound_nodes to legacy format
      if (key === "inbound_nodes" && Array.isArray(value) && value.length > 0) {
        const nodes: NewInboundNode[] = Array.isArray(value[0].args[0])
          ? value[0].args[0]
          : value[0].args
        const parsedNodes = nodes
          .map(parseInboundNode)
          .filter(Boolean) as LegacyInboundNode[]
        parsedValue = [[...parsedNodes]]
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
      }
      // return [parsedKey, parsedValue]
      acc[parsedKey] = parsedValue
      return acc
    }, {} as Record<string, unknown>) as T
  } else return obj
}

function parseKey(str: string) {
  // "batch_shape" -> "batch_input_shape"
  return str.replace("batch_shape", "batch_input_shape")
}

type NewInboundNode = {
  class_name: string
  config: {
    shape: (number | null)[]
    dtype: string
    keras_history: [string, number, number]
  }
}
type LegacyInboundNode = [string, number, number, Record<string, unknown>]

function parseInboundNode(node: NewInboundNode): LegacyInboundNode | undefined {
  if (typeof node !== "object" || node === null) {
    console.warn("Unknown inbound node format:", node)
    return
  }
  const keras_history = node.config.keras_history
  return [keras_history[0], 0, 0, {}]
}

function camelCaseToSnakeCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase()
}
