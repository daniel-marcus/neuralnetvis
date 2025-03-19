import { fetchMutlipleNpzWithProgress } from "@/data/npy-loader"
import type { DatasetDef } from "@/data/types"

export const fashionMnist: DatasetDef = {
  key: "fashion-mnist",
  name: "Fashion MNIST",
  task: "classification",
  description: "Clothing items (28x28)",
  version: new Date("2025-03-19"),
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
  loadFull: async () => {
    const [xTrain, yTrain, xTest, yTest] = await fetchMutlipleNpzWithProgress([
      "/data/fashion_mnist_20k/x_train.npz",
      "/data/fashion_mnist_20k/y_train.npz",
      "/data/fashion_mnist_20k/x_test.npz",
      "/data/fashion_mnist_20k/y_test.npz",
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
        "/data/fashion_mnist_20k/x_train_preview.npz",
        "/data/fashion_mnist_20k/y_train_preview.npz",
      ],
      true
    )
    // add depth dim for Conv2D layers
    xTrain.shape = [...xTrain.shape, 1]
    return { xTrain, yTrain }
  },
}
