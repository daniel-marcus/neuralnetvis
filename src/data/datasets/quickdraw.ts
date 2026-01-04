import { fetchMutlipleNpzWithProgress } from "@/data/npy-loader"
import { getModelDef } from "@/model/models"
import type { DatasetDef } from "@/data/types"

export const quickDraw: DatasetDef = {
  key: "quickdraw",
  name: "Quick, Draw!",
  task: "classification",
  description: "Drawings (28x28)",
  version: new Date("2026-01-04"),
  aboutUrl: "https://github.com/googlecreativelab/quickdraw-dataset",
  inputDims: [28, 28, 1],
  preprocessFunc: "normalizeImage",
  outputLabels: [
    "apple",
    "banana",
    "car",
    "cat",
    "dog",
    "fish",
    "flower",
    "house",
    "tree",
    "star",
    "sun",
    "moon",
    "cloud",
    "cup",
    "chair",
    "bed",
    "airplane",
    "bicycle",
    "bus",
    "clock",
    "eye",
    "face",
    "hand",
    "guitar",
    "key",
    "leaf",
    "light bulb",
    "pencil",
    "radio",
    "pizza",
    "smiley face",
    "snowman",
    "spoon",
    "table",
    "umbrella",
    "hourglass",
    "book",
    "butterfly",
    "candle",
    "door",
    "envelope",
    "hat",
    "ice cream",
    "laptop",
    "rainbow",
    "shoe",
    "sock",
    "tooth",
    "truck",
    "donut",
  ],
  model: getModelDef("quickdraw"),
  sampleViewer: true,
  loadFull: async () => {
    const [xTrain, yTrain, xTest, yTest] = await fetchMutlipleNpzWithProgress([
      "/data/quickdraw/x_train.npz",
      "/data/quickdraw/y_train.npz",
      "/data/quickdraw/x_test.npz",
      "/data/quickdraw/y_test.npz",
    ])
    // add depth dim for Conv2D layers
    xTrain.shape = [...xTrain.shape, 1]
    xTest.shape = [...xTest.shape, 1]
    return {
      xTrain,
      yTrain,
      xTest,
      yTest,
    }
  },
  loadPreview: async () => {
    const [xTrain, yTrain] = await fetchMutlipleNpzWithProgress(
      [
        "/data/quickdraw/x_train_preview.npz",
        "/data/quickdraw/y_train_preview.npz",
      ],
      true,
    )
    xTrain.shape = [...xTrain.shape, 1]
    return { xTrain, yTrain }
  },
}
