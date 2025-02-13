import { DatasetDef } from "@/data/data"
import * as tf from "@tensorflow/tfjs"
import { StandardScaler } from "@/data/normalization"
import { fetchMutlipleNpzWithProgress } from "@/data/npy-loader"

export const californiaHousing: DatasetDef = {
  key: "california_housing",
  name: "california housing",
  task: "regression",
  description: "Predict housing prices (8 features)",
  version: new Date("2025-02-08"),
  aboutUrl: "https://keras.io/api/datasets/california_housing/",
  loss: "meanSquaredError",
  input: {
    labels: [
      "longitude",
      "latitude",
      "housing_median_age",
      "total_rooms",
      "total_bedrooms",
      "population",
      "households",
      "median_income",
    ],
  },
  output: {
    size: 1,
    activation: "linear",
    labels: ["median_house_value"],
  },
  loadData: async () => {
    const [xTrain, yTrain, xTest, yTest] = await fetchMutlipleNpzWithProgress([
      "/data/california_housing/x_train.npz",
      "/data/california_housing/y_train.npz",
      "/data/california_housing/x_test.npz",
      "/data/california_housing/y_test.npz",
    ])
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
  },
}
