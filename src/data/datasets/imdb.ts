import { fetchMultipleNpzWithProgress } from "@/data/npy-loader"
import { getModelDef } from "@/model/models"
import type { DatasetDef } from "@/data/types"

export const imdb: DatasetDef = {
  key: "imdb",
  name: "IMDb",
  task: "classification",
  description: "Movie review sentiment analysis",
  version: new Date("2026-10-03"),
  aboutUrl: "https://ai.stanford.edu/~amaas/data/sentiment/",
  inputDims: [200],
  outputLabels: ["negative", "positive"],
  tokenizerName: "IMDbTokenizer",
  sampleViewer: true,
  model: getModelDef("imdb"),
  // Note: token ids in the npz files go up to ~88k (full word index), but the models' Embedding
  // layers only have inputDim 20000 (ids >= 20000 were <OOV> = 2 in training). WebGPU/WebGL gather
  // returns zero vectors for out-of-range ids (~2% of tokens), the WASM and CPU backends throw
  // "GatherV2: the index value ... is not in [0, 19999]". Fix if needed: map ids >= 20000 to 2 here
  // and pass the original data as xTrainRaw/xTestRaw so the sample viewer still shows the words.
  loadFull: async () => {
    const [xTrain, yTrain, xTest, yTest] = await fetchMultipleNpzWithProgress([
      "/data/imdb/x_train.npz",
      "/data/imdb/y_train.npz",
      "/data/imdb/x_test.npz",
      "/data/imdb/y_test.npz",
    ])
    return {
      xTrain,
      yTrain,
      xTest,
      yTest,
    }
  },
  loadPreview: async () => {
    const [xTrain, yTrain] = await fetchMultipleNpzWithProgress(
      ["/data/imdb/x_train_preview.npz", "/data/imdb/y_train_preview.npz"],
      true,
    )
    return { xTrain, yTrain }
  },
}
