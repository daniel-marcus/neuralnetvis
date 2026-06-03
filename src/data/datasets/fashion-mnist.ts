import { loadGrayscaleImageDataset } from "./load-helpers"
import { getModelDef } from "@/model/models"
import type { DatasetDef } from "@/data/types"

export const fashionMnist: DatasetDef = {
  key: "fashion-mnist",
  name: "Fashion MNIST",
  task: "classification",
  description: "Clothing items (28x28)",
  version: new Date("2025-09-26"),
  aboutUrl: "https://github.com/zalandoresearch/fashion-mnist",
  inputDims: [28, 28, 1],
  preprocessFunc: "normalizeImage",
  outputLabels: [
    "T-shirt/top",
    "Trouser",
    "Pullover",
    "Dress",
    "Coat",
    "Sandal",
    "Shirt",
    "Sneaker",
    "Bag",
    "Ankle boot",
  ],
  sampleViewer: true,
  model: getModelDef("fashion-mnist"),
  ...loadGrayscaleImageDataset("fashion_mnist_20k"),
}
