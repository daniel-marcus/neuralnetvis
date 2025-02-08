import { DatasetDef } from "@/lib/datasets"
import { fetchMutlipleNpzWithProgress } from "@/lib/npy-loader"

export const cifar10: DatasetDef = {
  key: "cifar10",
  name: "cifar10",
  task: "classification",
  description: "Color images (32x32x3)",
  version: new Date("2025-02-08"),
  aboutUrl: "https://www.cs.toronto.edu/~kriz/cifar.html",
  loss: "categoricalCrossentropy",
  input: {
    preprocess: (inputTensor) => inputTensor.div(255),
  },
  output: {
    size: 10,
    activation: "softmax",
    labels: [
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
  },
  loadData: async () => {
    const [xTrain1, xTrain2, xTrain3, yTrain, xTest, yTest] =
      await fetchMutlipleNpzWithProgress([
        "/data/cifar10_20k/x_train_1.npz",
        "/data/cifar10_20k/x_train_2.npz",
        "/data/cifar10_20k/x_train_3.npz",
        "/data/cifar10_20k/y_train.npz",
        "/data/cifar10_20k/x_test.npz",
        "/data/cifar10_20k/y_test.npz",
      ])
    const [, ...dims] = xTrain1.shape
    const length = xTrain1.shape[0] + xTrain2.shape[0] + xTrain3.shape[0]
    const xTrainData = new Uint8Array(length * dims.reduce((a, b) => a * b, 1))

    // concat xTrain1, xTrain2, xTrain3
    let offset = 0
    for (const arr of [xTrain1.data, xTrain2.data, xTrain3.data]) {
      xTrainData.set(arr, offset)
      offset += arr.length
    }

    const xTrain = {
      shape: [length, ...dims],
      data: xTrainData,
      dtype: xTrain1.dtype,
      fortranOrder: xTrain1.fortranOrder,
    }
    return { xTrain, yTrain, xTest, yTest }
  },
}
