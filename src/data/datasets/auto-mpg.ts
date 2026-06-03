import { fetchMutlipleNpzWithProgress } from "@/data/npy-loader"
import { scaleFeatures } from "./load-helpers"
import { getModelDef } from "@/model/models"
import type { DatasetDef } from "@/data/types"

export const autoMpg: DatasetDef = {
  key: "auto-mpg",
  name: "Auto MPG",
  task: "regression",
  description: "Predict fuel efficiency",
  version: new Date("2025-03-26"),
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
  outputLabels: ["miles_per_gallon"],
  model: getModelDef("auto-mpg"),
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
    true,
  )
  const xTrainNames = await fetch("/data/auto-mpg/x_train_names.json").then((r) => r.json())
  const xTestNames = await fetch("/data/auto-mpg/x_test_names.json").then((r) => r.json())
  const [xTrainScaled, xTestScaled] = scaleFeatures(xTrain, xTest)
  return {
    xTrain: { data: xTrainScaled, shape: xTrain.shape },
    xTrainRaw: xTrain,
    yTrain,
    xTest: { data: xTestScaled, shape: xTest.shape },
    xTestRaw: xTest,
    yTest,
    xTrainNames,
    xTestNames,
  }
}
