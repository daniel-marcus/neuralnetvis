import { loadGrayscaleImageDataset } from "./load-helpers"
import { getModelDef } from "@/model/models"
import type { DatasetDef } from "@/data/types"

export const mnist: DatasetDef = {
  key: "mnist",
  name: "MNIST",
  task: "classification",
  description: "Handwritten digits (28x28)",
  version: new Date("2026-01-04"),
  aboutUrl: "https://en.wikipedia.org/wiki/MNIST_database",
  inputDims: [28, 28, 1],
  preprocessFunc: "normalizeImage",
  outputLabels: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
  model: getModelDef("mnist"),
  sampleViewer: true,
  drawOptions: {
    title: "Draw a digit",
  },
  ...loadGrayscaleImageDataset("mnist_20k"),
}
