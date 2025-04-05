import { mnist } from "./mnist"
import type { Dataset } from "@/data/types"

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
