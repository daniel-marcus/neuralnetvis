import * as tf from "@tensorflow/tfjs"
import { StandardScaler } from "@/data/utils"
import { fetchMutlipleNpzWithProgress } from "@/data/npy-loader"
import type { DatasetDef } from "@/data/types"
import { getModelDef } from "@/model/models"

export const californiaHousing: DatasetDef = {
  key: "california-housing",
  name: "California Housing",
  task: "regression",
  description: "Predict housing prices",
  version: new Date("2025-04-02"),
  aboutUrl: "https://keras.io/api/datasets/california_housing/",
  inputDims: [8],
  inputLabels: [
    "longitude",
    "latitude",
    "housing_median_age",
    "total_rooms",
    "total_bedrooms",
    "population",
    "households",
    "median_income",
  ],
  outputLabels: ["median_house_value"],
  mapProps: {
    center: [-120.5, 37],
    zoom: 5.4,
    baseLayer: "/data/california_housing/california.geojson",
  },
  model: getModelDef("california-housing"),
  loadPreview: loadData,
}

async function loadData() {
  const [xTrain, yTrain, xTest, yTest] = await fetchMutlipleNpzWithProgress(
    [
      "/data/california_housing/x_train.npz",
      "/data/california_housing/y_train.npz",
      "/data/california_housing/x_test.npz",
      "/data/california_housing/y_test.npz",
    ],
    true
  )
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
  }
}
