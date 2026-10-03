import { fetchMultipleNpzWithProgress } from "@/data/npy-loader"
import type { DatasetDef } from "@/data/types"

export const tweets: DatasetDef = {
  key: "tweets",
  name: "Tweets",
  task: "classification", // TODO: next word prediction task (ys are token sequences, xs shifted by one)
  description: "Next word prediction on tweets",
  version: new Date("2026-10-04"),
  disabled: true, // until next word prediction is supported (training, evaluation, sample y)
  aboutUrl: "http://help.sentiment140.com/",
  // <START> + up to 31 words (+ <END>) + <PAD>..., see ml-notebooks/tweets.py
  inputDims: [32],
  outputLabels: [], // TODO: vocabulary (10k words in tweets_word_index.json)
  tokenizerName: "TweetsTokenizer",
  sampleViewer: true,
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
