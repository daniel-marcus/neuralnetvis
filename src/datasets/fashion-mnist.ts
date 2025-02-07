import { DatasetDef } from "@/lib/datasets"
import * as tf from "@tensorflow/tfjs"
import { fetchMutlipleNpzWithProgress } from "@/lib/npy-loader"

export const fashionMnist: DatasetDef = {
  name: "fashion mnist",
  task: "classification",
  description: "Clothing items (28x28)",
  version: 1,
  aboutUrl: "https://github.com/zalandoresearch/fashion-mnist",
  loss: "categoricalCrossentropy",
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
    return tf.tidy(() => {
      // add channel dimension [,28,28] -> [,28,28,1], needed for Conv2D
      // normalize: vals / 255
      const trainX = tf.tensor(xTrain.data, [...xTrain.shape, 1]).div(255)
      const testX = tf.tensor(xTest.data, [...xTest.shape, 1]).div(255)
      const trainY = tf.oneHot(yTrain.data, 10)
      const testY = tf.oneHot(yTest.data, 10)
      return { trainX, trainY, testX, testY }
    })
  },
}
