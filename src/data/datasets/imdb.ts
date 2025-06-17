import { fetchMutlipleNpzWithProgress } from "@/data/npy-loader"
import { getModelDef } from "@/model/models"
import type { DatasetDef } from "@/data/types"

export const imdb: DatasetDef = {
  key: "imdb",
  name: "IMDb",
  task: "classification",
  description: "Movie review sentiment analysis",
  version: new Date("2025-06-16"),
  aboutUrl: "https://ai.stanford.edu/~amaas/data/sentiment/",
  inputDims: [200],
  outputLabels: ["negative", "positive"],
  tokenizerName: "IMDbTokenizer",
  model: getModelDef("imdb"),
  loadFull: async () => {
    const [xTrain, yTrain, xTest, yTest] = await fetchMutlipleNpzWithProgress([
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
    const [xTrain, yTrain] = await fetchMutlipleNpzWithProgress(
      ["/data/imdb/x_train_preview.npz", "/data/imdb/y_train_preview.npz"],
      true
    )
    return { xTrain, yTrain }
  },
}
