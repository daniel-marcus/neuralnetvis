// Converts a Keras 3 .keras file to tfjs layers format (model.json + weights.bin) with the importer of the app.
// Loaded by ../convert-keras.ts with the ESM builds of tfjs (see there).
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { basename, join } from "node:path"
import * as tf from "@tensorflow/tfjs"
import "@/model/layers" // registers the custom layers (MultiHeadAttention, ReversibleEmbedding, ...)
import { importKerasModel } from "@/model/import-keras"

export async function convertKerasModel(kerasPath: string, outDir: string) {
  await tf.setBackend("cpu")
  const buffer = await readFile(kerasPath)
  const model = await importKerasModel(new File([buffer], basename(kerasPath)))
  if (!model) throw new Error(`Import of ${kerasPath} failed`)

  await mkdir(outDir, { recursive: true })
  await model.save(
    tf.io.withSaveHandler(async (artifacts) => {
      const weightData = artifacts.weightData as ArrayBuffer
      await writeFile(join(outDir, "weights.bin"), Buffer.from(weightData))
      const modelJson = {
        modelTopology: artifacts.modelTopology,
        format: artifacts.format,
        generatedBy: artifacts.generatedBy,
        convertedBy: artifacts.convertedBy,
        weightsManifest: [{ paths: ["./weights.bin"], weights: artifacts.weightSpecs }],
      }
      await writeFile(join(outDir, "model.json"), JSON.stringify(modelJson))
      return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: "JSON" } }
    }),
  )

  // sanity check: the saved files give the same predictions as the imported model
  const reloaded = await loadFromDir(outDir)
  const maxDiff = tf.tidy(() => {
    const x = randomInput(model)
    const a = model.predict(x) as tf.Tensor
    const b = reloaded.predict(x) as tf.Tensor
    return a.sub(b).abs().max().dataSync()[0]
  })
  if (maxDiff > 1e-5) throw new Error(`Reloaded model differs from the imported one: ${maxDiff}`)

  return { name: model.name, numLayers: model.layers.length, numParams: model.countParams() }
}

async function loadFromDir(dir: string) {
  const modelJson = JSON.parse(await readFile(join(dir, "model.json"), "utf-8"))
  const weights = await readFile(join(dir, "weights.bin"))
  return tf.loadLayersModel(
    tf.io.fromMemory({
      modelTopology: modelJson.modelTopology,
      weightSpecs: modelJson.weightsManifest[0].weights,
      weightData: weights.buffer.slice(weights.byteOffset, weights.byteOffset + weights.byteLength),
    }),
  )
}

function randomInput(model: tf.LayersModel) {
  const [input] = model.inputs
  const shape = [2, ...input.shape.slice(1).map((d) => d ?? 1)]
  // token ids for int inputs (embeddings), random values otherwise
  return input.dtype === "int32" ? tf.randomUniformInt(shape, 0, 2) : tf.randomNormal(shape)
}
