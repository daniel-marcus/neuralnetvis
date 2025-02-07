import { DatasetDef } from "@/lib/datasets"
import * as tf from "@tensorflow/tfjs"
import { fetchMutlipleNpzWithProgress } from "@/lib/npy-loader"

export const cifar10: DatasetDef = {
  name: "cifar10",
  task: "classification",
  description: "Color images (32x32x3)",
  version: 1,
  aboutUrl: "https://www.cs.toronto.edu/~kriz/cifar.html",
  loss: "categoricalCrossentropy",
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
    return tf.tidy(() => {
      const combinedTrainX = tf.concat([
        tf.tensor(xTrain1.data, xTrain1.shape),
        tf.tensor(xTrain2.data, xTrain2.shape),
        tf.tensor(xTrain3.data, xTrain3.shape),
      ])
      // normalize: vals / 255
      const trainX = combinedTrainX.div(255)
      const testX = tf.tensor(xTest.data, xTest.shape).div(255)
      const trainY = tf.oneHot(yTrain.data, 10)
      const testY = tf.oneHot(yTest.data, 10)
      return { trainX, trainY, testX, testY }
    })
  },
}
