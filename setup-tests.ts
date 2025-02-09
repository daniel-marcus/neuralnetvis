import "fake-indexeddb/auto"
import "@tensorflow/tfjs-node"
import { beforeAll } from "vitest"
import { mnist } from "@/datasets/mnist"
import { loadAndSaveDsData } from "@/data/datasets"

beforeAll(async () => {
  console.log("Putting mnist data into fake indexedDB ...")
  await loadAndSaveDsData(mnist)
})
