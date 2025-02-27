import { DatasetDef } from "@/data"
import { fetchMutlipleNpzWithProgress } from "@/data/npy-loader"

export const mnist: DatasetDef = {
  key: "mnist",
  name: "mnist",
  task: "classification",
  description: "Handwritten digits (28x28)",
  version: new Date("2025-02-27"),
  aboutUrl: "https://en.wikipedia.org/wiki/MNIST_database",
  inputDims: [28, 28, 1],
  preprocess: (inputTensor) => inputTensor.div(255),
  outputLabels: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
  loadData: async () => {
    const [xTrain, yTrain, xTest, yTest] = await fetchMutlipleNpzWithProgress([
      "/data/mnist_20k/x_train.npz",
      "/data/mnist_20k/y_train.npz",
      "/data/mnist_20k/x_test.npz",
      "/data/mnist_20k/y_test.npz",
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
}
