import { useEffect } from "react"
import { useStore } from "@/store"
import { datasets } from "./datasets"
import { getData, putData, putDataBatches } from "./db"
import type { DatasetDef, DbBatch, ParsedLike, StoreMeta } from "./types"

export function useDataset() {
  const datasetKey = useStore((s) => s.datasetKey)
  const ds = useStore((s) => s.ds)
  const setStatusText = useStore((s) => s.status.setText)

  useEffect(() => {
    const dsDef = datasets.find((d) => d.key === datasetKey)
    if (!dsDef) return

    loadData()
    async function loadData() {
      if (!dsDef) return
      const existingTrain = await getData<StoreMeta>(dsDef.key, "meta", "train")
      const hasLatestData =
        existingTrain?.version.getTime() === dsDef.version.getTime()
      if (existingTrain && !hasLatestData) {
        console.log("old data in indexedDB, updating ...")
      }
      if (existingTrain && hasLatestData) {
        console.log("found data in indexedDB")
        const train = await getData<StoreMeta>(dsDef.key, "meta", "train") // TODO: type keys
        const test = await getData<StoreMeta>(dsDef.key, "meta", "test")
        if (!train || !test) {
          throw new Error("Failed to load indexedDB store")
        }
        const ds = { ...dsDef, train, test }
        useStore.setState({ ds })
      } else {
        console.log("loading new data into indexedDB ...")
        await loadAndSaveDsData(dsDef)
        const train = await getData<StoreMeta>(dsDef.key, "meta", "train") // TODO: type keys
        const test = await getData<StoreMeta>(dsDef.key, "meta", "test")
        if (!train || !test) {
          throw new Error("Failed to create indexedDB store")
        }
        const ds = { ...dsDef, train, test }
        useStore.setState({ ds })
      }
    }

    return () => {
      useStore.setState({ ds: undefined })
    }
  }, [datasetKey, setStatusText])

  return ds
}

export async function loadAndSaveDsData(dsDef: DatasetDef) {
  const { version } = dsDef
  const { xTrain, yTrain, xTest, yTest, xTrainRaw, xTestRaw } =
    await dsDef.loadData()
  await saveData(dsDef.key, "train", xTrain, yTrain, xTrainRaw, version)
  await saveData(dsDef.key, "test", xTest, yTest, xTestRaw, version)
}

async function saveData(
  dbName: DatasetDef["key"],
  storeName: "train" | "test",
  xs: ParsedLike,
  ys: ParsedLike,
  xsRaw: ParsedLike | undefined,
  version: Date,
  storeBatchSize = 100
) {
  const [totalSamples, ...dims] = xs.shape
  const valsPerSample = dims.reduce((a, b) => a * b)

  const batches: DbBatch[] = []
  for (let i = 0; i < totalSamples; i += storeBatchSize) {
    const sliceIdxs = [i * valsPerSample, (i + storeBatchSize) * valsPerSample]
    const batch = {
      index: Math.floor(i / storeBatchSize),
      xs: xs.data.slice(...sliceIdxs),
      ys: ys.data.slice(i, i + storeBatchSize),
      xsRaw: xsRaw?.data.slice(...sliceIdxs),
    }
    batches.push(batch)
  }

  await putDataBatches(dbName, storeName, batches)

  await putData<StoreMeta>(dbName, "meta", {
    index: storeName,
    version,
    shapeX: xs.shape,
    shapeY: ys.shape,
    storeBatchSize,
    valsPerSample,
  })
}
