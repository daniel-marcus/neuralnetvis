import { useEffect } from "react"
import { useStore } from "@/store"
import { datasets } from "./datasets"
import { deleteAll, getData, putData, putDataBatches } from "./db"
import type {
  Dataset,
  DatasetDef,
  DbBatch,
  ParsedLike,
  StoreMeta,
} from "./types"

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
      const skipLoading = existingTrain && hasLatestData
      await setDsFromDsDef(dsDef, skipLoading)
    }
    return () => {
      useStore.setState({ ds: undefined })
    }
  }, [datasetKey, setStatusText])

  return ds
}

export async function setDsFromDsDef(dsDef: DatasetDef, skipLoading?: boolean) {
  if (!skipLoading) await loadAndSaveDsData(dsDef)
  const train = await getData<StoreMeta>(dsDef.key, "meta", "train") // TODO: type keys
  const test = await getData<StoreMeta>(dsDef.key, "meta", "test")
  if (!train || !test) {
    throw new Error("Failed to create indexedDB store")
  }
  const ds = { ...dsDef, train, test }
  useStore.setState({ ds })
}

export async function loadAndSaveDsData(dsDef: DatasetDef) {
  const { xTrain, yTrain, xTest, yTest, xTrainRaw, xTestRaw } =
    await dsDef.loadData()
  await saveData(dsDef, "train", xTrain, yTrain, xTrainRaw)
  await saveData(dsDef, "test", xTest, yTest, xTestRaw)
}

async function saveData(
  ds: DatasetDef | Dataset,
  storeName: "train" | "test",
  xs: ParsedLike,
  ys: ParsedLike,
  xsRaw?: ParsedLike
) {
  const { key: dbName, version, storeBatchSize = 100 } = ds

  const existingMeta = await getData<StoreMeta>(dbName, "meta", storeName)
  // TODO: checkShapeMatch for dims and throw error if not
  const oldSamplesX = existingMeta?.shapeX[0] ?? 0
  const oldSamplesY = existingMeta?.shapeY[0] ?? 0
  const [newSamplesX, ...dimsX] = xs.shape
  const [newSamplesY, ...dimsY] = ys.shape

  const [totalSamples, ...dims] = xs.shape
  const valsPerSample = dims.reduce((a, b) => a * b)

  const batches: DbBatch[] = []
  for (let i = 0; i < totalSamples; i += storeBatchSize) {
    const index = Math.floor((i + oldSamplesX) / storeBatchSize)
    const sliceIdxs = [i * valsPerSample, (i + storeBatchSize) * valsPerSample]
    const batch = {
      index,
      xs: xs.data.slice(...sliceIdxs),
      ys: ys.data.slice(i, i + storeBatchSize),
      xsRaw: xsRaw?.data.slice(...sliceIdxs),
    }
    batches.push(batch)
  }

  await putDataBatches(dbName, storeName, batches)

  const newStoreMeta = {
    index: storeName,
    version,
    shapeX: [oldSamplesX + newSamplesX, ...dimsX],
    shapeY: [oldSamplesY + newSamplesY, ...dimsY],
    storeBatchSize,
    valsPerSample,
  }
  await putData<StoreMeta>(dbName, "meta", newStoreMeta)

  return newStoreMeta
}

export async function addTrainData(xs: ParsedLike, ys: ParsedLike) {
  const ds = useStore.getState().ds
  if (!ds) return
  const newTrainMeta = await saveData(ds, "train", xs, ys)
  const newDs = { ...ds, train: newTrainMeta }
  useStore.setState({ ds: newDs, skipModelCreate: true })
}

export async function resetData(storeName: "train" | "test") {
  // for current ds
  const ds = useStore.getState().ds
  if (!ds) return
  await deleteAll(ds.key, storeName)
  const storeMeta = await getData<StoreMeta>(ds.key, "meta", storeName)
  if (!storeMeta) return
  const newStoreMeta = {
    ...storeMeta,
    shapeX: [0, ...storeMeta.shapeX.slice(1)],
    shapeY: [0, ...storeMeta.shapeY.slice(1)],
  }
  await putData(ds.key, "meta", newStoreMeta)
  const newDs = { ...ds, [storeName]: newStoreMeta }
  useStore.setState({ ds: newDs, skipModelCreate: true })
}
