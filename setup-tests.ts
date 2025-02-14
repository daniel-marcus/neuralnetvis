import "fake-indexeddb/auto"
import "@tensorflow/tfjs-node"
import { beforeAll } from "vitest"
import { mnist } from "@/data/datasets/mnist"
import { loadAndSaveDsData } from "@/data/dataset"

beforeAll(async () => {
  console.log("Putting mnist data into fake indexedDB ...")
  await loadAndSaveDsData(mnist)
})
