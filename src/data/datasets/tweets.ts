import { fetchMultipleNpzWithProgress } from "@/data/npy-loader"
import { getModelDef } from "@/model/models"
import type { DatasetDef } from "@/data/types"

export const tweets: DatasetDef = {
  key: "tweets",
  name: "Tweets",
  task: "nextToken",
  description: "Next word prediction on tweets",
  version: new Date("2026-10-04"),
  aboutUrl: "https://www.kaggle.com/datasets/kazanova/sentiment140",
  // <START> + up to 31 words (+ <END>) + <PAD>..., see ml-notebooks/tweets.py
  inputDims: [32],
  outputLabels: [], // vocabulary from the tokenizer, see getVocabulary in dataset.ts
  tokenizerName: "TweetsTokenizer",
  model: getModelDef("tweets"),
  sampleViewer: true,
  drawOptions: {
    title: "Write a tweet",
  },
  loadFull: async () => {
    const [xTrain, yTrain, xTest, yTest] = await fetchMultipleNpzWithProgress([
      "/data/tweets/x_train.npz",
      "/data/tweets/y_train.npz",
      "/data/tweets/x_test.npz",
      "/data/tweets/y_test.npz",
    ])
    return { xTrain, yTrain, xTest, yTest }
  },
  loadPreview: async () => {
    const [xTrain, yTrain] = await fetchMultipleNpzWithProgress(
      ["/data/tweets/x_train_preview.npz", "/data/tweets/y_train_preview.npz"],
      true,
    )
    return { xTrain, yTrain }
  },
}
