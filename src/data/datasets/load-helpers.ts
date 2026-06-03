import * as tf from "@tensorflow/tfjs"
import { StandardScaler } from "@/data/utils"
import { fetchMutlipleNpzWithProgress } from "@/data/npy-loader"

type NpzArray = Awaited<ReturnType<typeof fetchMutlipleNpzWithProgress>>[number]

export function loadGrayscaleImageDataset(prefix: string) {
  return {
    loadFull: async () => {
      const [xTrain, yTrain, xTest, yTest] = await fetchMutlipleNpzWithProgress([
        `/data/${prefix}/x_train.npz`,
        `/data/${prefix}/y_train.npz`,
        `/data/${prefix}/x_test.npz`,
        `/data/${prefix}/y_test.npz`,
      ])
      // add depth dim for Conv2D layers
      xTrain.shape = [...xTrain.shape, 1]
      xTest.shape = [...xTest.shape, 1]
      return { xTrain, yTrain, xTest, yTest }
    },
    loadPreview: async () => {
      const [xTrain, yTrain] = await fetchMutlipleNpzWithProgress(
        [`/data/${prefix}/x_train_preview.npz`, `/data/${prefix}/y_train_preview.npz`],
        true,
      )
      xTrain.shape = [...xTrain.shape, 1]
      return { xTrain, yTrain }
    },
  }
}

export function loadCifarDataset(prefix: string) {
  return {
    loadFull: async () => {
      const [xTrain1, xTrain2, xTrain3, yTrain, xTest, yTest] = await fetchMutlipleNpzWithProgress([
        `/data/${prefix}/x_train_1.npz`,
        `/data/${prefix}/x_train_2.npz`,
        `/data/${prefix}/x_train_3.npz`,
        `/data/${prefix}/y_train.npz`,
        `/data/${prefix}/x_test.npz`,
        `/data/${prefix}/y_test.npz`,
      ])
      const [, ...dims] = xTrain1.shape
      const length = xTrain1.shape[0] + xTrain2.shape[0] + xTrain3.shape[0]
      const xTrainData = new Uint8Array(length * dims.reduce((a, b) => a * b, 1))
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
    loadPreview: async () => {
      const [xTrain, yTrain] = await fetchMutlipleNpzWithProgress(
        [`/data/${prefix}/x_train_preview.npz`, `/data/${prefix}/y_train_preview.npz`],
        true,
      )
      return { xTrain, yTrain }
    },
  }
}

export function scaleFeatures(xTrain: NpzArray, xTest: NpzArray) {
  return tf.tidy(() => {
    const trainXRaw = tf.tensor(xTrain.data, xTrain.shape)
    const scaler = new StandardScaler()
    const trainX = scaler.fitTransform(trainXRaw)
    const testX = scaler.transform(tf.tensor(xTest.data, xTest.shape))
    const xTrainScaled = trainX.reshape([-1]).dataSync() as Float32Array
    const xTestScaled = testX.reshape([-1]).dataSync() as Float32Array
    return [xTrainScaled, xTestScaled] as const
  })
}
