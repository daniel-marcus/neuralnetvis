import * as tf from "@tensorflow/tfjs"
import { StandardScaler } from "@/data/utils"
import { fetchMutlipleNpzWithProgress } from "@/data/npy-loader"
import type { DatasetDef } from "@/data/types"

export const autoMpg: DatasetDef = {
  key: "auto-mpg",
  name: "auto mpg",
  task: "regression",
  description: "Predict fuel efficiency",
  version: new Date("2025-03-18"),
  aboutUrl: "https://archive.ics.uci.edu/dataset/9/auto+mpg",
  inputDims: [9],
  inputLabels: [
    "cylinders",
    "displacement",
    "horsepower",
    "weight",
    "acceleration",
    "model_year",
    "usa",
    "europe",
    "japan",
  ],
  outputLabels: ["miles_per_galon"],
  loadPreview: loadData,
}

async function loadData() {
  const [xTrain, yTrain, xTest, yTest] = await fetchMutlipleNpzWithProgress(
    [
      "/data/auto-mpg/x_train.npz",
      "/data/auto-mpg/y_train.npz",
      "/data/auto-mpg/x_test.npz",
      "/data/auto-mpg/y_test.npz",
    ],
    true
  )
  const xTrainNames = await fetch("/data/auto-mpg/x_train_names.json").then(
    (r) => r.json()
  )
  console.log({ xTrainNames })
  const [xTrainScaled, xTestScaled] = tf.tidy(() => {
    const trainXRaw = tf.tensor(xTrain.data, xTrain.shape)
    const scaler = new StandardScaler()
    const trainX = scaler.fitTransform(trainXRaw)
    const testX = scaler.transform(tf.tensor(xTest.data, xTest.shape))
    const xTrainScaled = trainX.reshape([-1]).dataSync() as Float32Array
    const xTestScaled = testX.reshape([-1]).dataSync() as Float32Array
    return [xTrainScaled, xTestScaled] as const
  })
  return {
    xTrain: { data: xTrainScaled, shape: xTrain.shape },
    xTrainRaw: xTrain,
    yTrain,
    xTest: { data: xTestScaled, shape: xTest.shape },
    xTestRaw: xTest,
    yTest,
    xTrainNames,
  }
}
