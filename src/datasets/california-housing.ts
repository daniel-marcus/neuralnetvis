import { DatasetDef } from "@/lib/datasets"
// import * as tf from "@tensorflow/tfjs"
// import { StandardScaler } from "@/lib/normalization"
import { fetchMutlipleNpzWithProgress } from "@/lib/npy-loader"

export const californiaHousing: DatasetDef = {
  key: "california_housing",
  name: "california housing",
  task: "regression",
  description: "Predict housing prices (8 features)",
  version: 1,
  aboutUrl: "https://keras.io/api/datasets/california_housing/",
  loss: "meanSquaredError",
  input: {
    // TODO ...
    // preprocess: (data) => applyStandardScaler(data as number[][]),
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
    // TODO: apply standard scaler
    return {
      xTrain,
      yTrain,
      xTest,
      yTest,
    }
    /* return tf.tidy(() => {
      const trainXRaw = tf.tensor(xTrain.data, xTrain.shape)
      const scaler = new StandardScaler()
      const trainX = scaler.fitTransform(trainXRaw)
      const testX = scaler.transform(tf.tensor(xTest.data, xTest.shape))
      const trainY = tf.tensor(yTrain.data)
      const testY = tf.tensor(yTest.data)
      return { trainXRaw, trainX, trainY, testX, testY }
    }) */
  },
}
