import { loadCifarDataset } from "./load-helpers"
import { getModelDef } from "@/model/models"
import type { DatasetDef } from "@/data/types"

export const cifar10: DatasetDef = {
  key: "cifar-10",
  name: "CIFAR-10",
  task: "classification",
  description: "Color images (32x32x3)",
  version: new Date("2025-09-26"),
  aboutUrl: "https://www.cs.toronto.edu/~kriz/cifar.html",
  inputDims: [32, 32, 3],
  preprocessFunc: "normalizeImage",
  outputLabels: [
    "airplane",
    "automobile",
    "bird",
    "cat",
    "deer",
    "dog",
    "frog",
    "horse",
    "ship",
    "truck",
  ],
  sampleViewer: true,
  model: getModelDef("cifar-10"),
  ...loadCifarDataset("cifar10_18k"),
}
