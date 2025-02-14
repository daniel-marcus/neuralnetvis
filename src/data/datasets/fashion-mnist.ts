import { DatasetDef } from "@/data"
import { fetchMutlipleNpzWithProgress } from "@/data/npy-loader"

export const fashionMnist: DatasetDef = {
  key: "fashion_mnist",
  name: "fashion mnist",
  task: "classification",
  description: "Clothing items (28x28)",
  version: new Date("2025-02-08"),
  aboutUrl: "https://github.com/zalandoresearch/fashion-mnist",
  loss: "categoricalCrossentropy",
  input: {
    preprocess: (inputTensor) => inputTensor.div(255),
  },
  output: {
    size: 10,
    activation: "softmax",
    labels: [
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
  },
  loadData: async () => {
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
}
