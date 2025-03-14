import { Dataset } from "@/data"
import { mnist } from "./mnist"

export const dsMnistMock: Dataset = {
  ...mnist,
  loaded: "full",
  storeBatchSize: 100,
  train: {
    index: "train",
    totalSamples: 20000,
  },
  test: {
    index: "test",
    totalSamples: 2000,
  },
}
