import { useStore } from "@/store"
import { datasets } from "./datasets"
import { deleteAll, getData, putData, putDataBatches } from "./db"
import type {
  Dataset,
  DatasetDef,
  DatasetMeta,
  DbBatch,
  ParsedLike,
  StoreMeta,
} from "./types"
import { preprocessFuncs } from "./preprocess"
import { useEffect, useState } from "react"

export const DEFAULT_STORE_BATCH_SIZE = 100

export function useDataset(dsDef?: DatasetDef, isPreview?: boolean) {
  const [ds, setDs] = useState<Dataset | undefined>(undefined)
  useEffect(() => {
    // TODO !!
    async function loadDs() {
      if (!dsDef) return
      const ds = await getDsFromDef(dsDef, isPreview)
      setDs(ds)
    }
    loadDs()
  }, [dsDef, isPreview])
  return ds
}

export async function setDsFromKey(key: string) {
  const dsDef = datasets.find((d) => d.key === key)
  if (!dsDef) return
  const existingMeta = await getData<DatasetMeta>(dsDef.key, "meta", "dsMeta")
  const hasLatestData =
    existingMeta?.version.getTime() === dsDef.version.getTime()
  const skipLoading = existingMeta && hasLatestData
  await setDsFromDef(dsDef, skipLoading)
}

export async function setDsFromDb(key: string) {
  const dsMeta = await getData<DatasetMeta>(key, "meta", "dsMeta")
  if (!dsMeta) return
  await setDsFromDef(dsMeta, true)
}

function newStoreMeta(storeName: "train" | "test", totalSamples = 0) {
  return { index: storeName, totalSamples }
}

export async function getDsFromDef(
  dsDef: DatasetDef | DatasetMeta,
  isPreview?: boolean
) {
  const existingMeta = await getData<DatasetMeta>(dsDef.key, "meta", "dsMeta")
  const hasLatestData =
    existingMeta?.version.getTime() === dsDef.version.getTime()
  const skipLoading =
    existingMeta && hasLatestData && (!existingMeta.isPreview || isPreview)

  if (!skipLoading) await loadAndSaveDsData(dsDef, isPreview)

  const { key } = dsDef
  const train =
    (await getData<StoreMeta>(key, "meta", "train")) ?? newStoreMeta("train")
  const test =
    (await getData<StoreMeta>(key, "meta", "test")) ?? newStoreMeta("test")
  const storeBatchSize = dsDef.storeBatchSize || DEFAULT_STORE_BATCH_SIZE
  const preprocess = getPreprocessFunc(dsDef)
  const ds: Dataset = { ...dsDef, train, test, preprocess, storeBatchSize }
  return ds
}

export function getPreprocessFunc(dsDef: DatasetDef | DatasetMeta) {
  return dsDef.preprocessFunc
    ? preprocessFuncs[dsDef.preprocessFunc]
    : undefined
}

export async function setDsFromDef(
  dsDef: DatasetDef | DatasetMeta,
  skipLoading?: boolean
) {
  const ds = await getDsFromDef(dsDef, skipLoading)
  useStore.setState({ ds, sample: undefined, sampleIdx: 0 })
}

export async function loadAndSaveDsData(
  dsDef: DatasetDef,
  isPreview?: boolean
) {
  const load = isPreview ? dsDef.loadPreview : dsDef.loadData
  if (load) {
    const { xTrain, yTrain, xTest, yTest, xTrainRaw, xTestRaw } = await load()
    await saveData(dsDef, "train", xTrain, yTrain, xTrainRaw)
    if (xTest && yTest) await saveData(dsDef, "test", xTest, yTest, xTestRaw)
  }
  const dsMeta = dsDefToDsMeta(dsDef)
  await putData(dsDef.key, "meta", { index: "dsMeta", ...dsMeta, isPreview })
}

function dsDefToDsMeta(dsDef: DatasetDef): DatasetMeta {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { loadData, loadPreview, ...dsMeta } = dsDef
  return dsMeta
}

async function saveData(
  ds: DatasetDef | Dataset,
  storeName: "train" | "test",
  xs: ParsedLike,
  ys: ParsedLike,
  xsRaw?: ParsedLike
) {
  const { key: dbName, storeBatchSize = DEFAULT_STORE_BATCH_SIZE } = ds

  const existingMeta = await getData<StoreMeta>(dbName, "meta", storeName)
  const oldSamplesX = existingMeta?.totalSamples ?? 0
  const [newSamplesX] = xs.shape
  const valsPerSample = ds.inputDims.reduce((a, b) => a * b)

  const batches: DbBatch[] = []
  for (let i = 0; i < newSamplesX; i += storeBatchSize) {
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

  const totalSamples = oldSamplesX + newSamplesX
  const storeMeta = newStoreMeta(storeName, totalSamples)
  await putData<StoreMeta>(dbName, "meta", storeMeta)
  return storeMeta
}

export async function addTrainData(
  xs: ParsedLike,
  ys: ParsedLike,
  xsRaw?: ParsedLike
) {
  const ds = useStore.getState().ds
  if (!ds) return
  const newTrainMeta = await saveData(ds, "train", xs, ys, xsRaw)
  const newDs = { ...ds, train: newTrainMeta }
  useStore.setState({ ds: newDs, skipModelCreate: true })
}

export async function resetData(dsKey: string, storeName: "train" | "test") {
  await deleteAll(dsKey, storeName)
  const storeMeta = newStoreMeta(storeName, 0)
  await putData(dsKey, "meta", storeMeta)

  const currDs = useStore.getState().ds
  if (currDs?.key === dsKey) {
    const newDs = { ...currDs, [storeName]: storeMeta }
    useStore.setState({ ds: newDs, skipModelCreate: true })
  }
}
