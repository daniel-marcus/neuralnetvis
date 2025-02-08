import { DatasetDef } from "@/lib/datasets"
import { fetchMutlipleNpzWithProgress } from "@/lib/npy-loader"

export const mnist: DatasetDef = {
  key: "mnist",
  name: "mnist",
  task: "classification",
  description: "Handwritten digits (28x28)",
  version: 1,
  aboutUrl: "https://en.wikipedia.org/wiki/MNIST_database",
  loss: "categoricalCrossentropy",
  input: {
    preprocess: (inputTensor) => inputTensor.div(255),
  },
  output: {
    size: 10,
    activation: "softmax",
    labels: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
  },
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
