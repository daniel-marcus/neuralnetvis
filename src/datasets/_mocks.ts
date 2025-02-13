import { Dataset } from "@/data/datasets"
import { mnist } from "@/datasets/mnist"

export const dsMnistMock: Dataset = {
  ...mnist,
  train: {
    index: "train",
    version: new Date(),
    storeBatchSize: 100,
    valsPerSample: 784,
    shapeX: [20000, 784],
    shapeY: [20000, 10],
  },
  test: {
    index: "test",
    version: new Date(),
    storeBatchSize: 100,
    valsPerSample: 784,
    shapeX: [2000, 784],
    shapeY: [2000, 10],
  },
}
