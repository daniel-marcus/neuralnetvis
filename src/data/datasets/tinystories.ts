import { fetchMultipleNpzWithProgress } from "@/data/npy-loader"
import { getModelDef } from "@/model/models"
import type { DatasetDef } from "@/data/types"

export const tinyStories: DatasetDef = {
  key: "tinystories",
  name: "TinyStories",
  task: "nextToken",
  description: "Next token prediction on short stories (pretrained TinyStories-1M)",
  version: new Date("2026-10-04"),
  aboutUrl: "https://huggingface.co/datasets/roneneldan/TinyStories",
  // <|endoftext|> \n story \n <|endoftext|> + padding (<|endoftext|>), cut off after 256 tokens,
  // see ml-notebooks/tinystories.py
  inputDims: [256],
  outputLabels: [], // vocabulary from the tokenizer, see getVocabulary in dataset.ts
  tokenizerName: "TinyStoriesTokenizer",
  model: getModelDef("tinystories"),
  sampleViewer: true,
  drawOptions: {
    title: "Write a story",
  },
  loadFull: async () => {
    const [xTrain, yTrain, xTest, yTest] = await fetchMultipleNpzWithProgress([
      "/data/tinystories/x_train.npz",
      "/data/tinystories/y_train.npz",
      "/data/tinystories/x_test.npz",
      "/data/tinystories/y_test.npz",
    ])
    return { xTrain, yTrain, xTest, yTest }
  },
  loadPreview: async () => {
    const [xTrain, yTrain] = await fetchMultipleNpzWithProgress(
      ["/data/tinystories/x_train_preview.npz", "/data/tinystories/y_train_preview.npz"],
      true,
    )
    return { xTrain, yTrain }
  },
}
