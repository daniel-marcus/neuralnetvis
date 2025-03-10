import { useSceneStore } from "@/store"
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
import { useEffect, useMemo } from "react"

export const DEFAULT_STORE_BATCH_SIZE = 100

export function useDataset(dsDef?: DatasetDef, isPreview?: boolean) {
  const ds = useSceneStore((s) => s.ds)
  const setDs = useSceneStore((s) => s.setDs)
  const shouldLoadFullDs = useSceneStore((s) => s.shouldLoadFullDs)
  useEffect(() => {
    async function loadDs() {
      if (!dsDef) return
      const ds = await getDsFromDef(dsDef, isPreview, shouldLoadFullDs)
      setDs(ds)
    }
    loadDs()
  }, [dsDef, isPreview, setDs, shouldLoadFullDs])
  return ds
}

export function useDsDef(dsKey?: string) {
  // TODO: also use user generated from db
  return useMemo(() => datasets.find((d) => d.key === dsKey), [dsKey])
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
  isPreview?: boolean,
  shouldLoadFullDs?: boolean
) {
  const existingMeta = await getData<DatasetMeta>(dsDef.key, "meta", "dsMeta")
  const hasLatestData =
    existingMeta?.version.getTime() === dsDef.version.getTime()
  const skipLoading =
    existingMeta &&
    hasLatestData &&
    (existingMeta.loaded === "full" || !shouldLoadFullDs)

  let newMeta: DatasetMeta | undefined
  if (!skipLoading) {
    newMeta = await loadAndSaveDsData(dsDef, isPreview)
  }

  const { key } = dsDef
  const train =
    (await getData<StoreMeta>(key, "meta", "train")) ?? newStoreMeta("train")
  const test =
    (await getData<StoreMeta>(key, "meta", "test")) ?? newStoreMeta("test")
  const storeBatchSize = dsDef.storeBatchSize || DEFAULT_STORE_BATCH_SIZE
  const preprocess = getPreprocessFunc(dsDef)
  const ds: Dataset = {
    ...dsDef,
    train,
    test,
    preprocess,
    storeBatchSize,
    loaded: newMeta?.loaded ?? existingMeta?.loaded ?? "preview",
  }
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
  console.log("TOOD: setDsFromDef", ds)
  // useGlobalStore.setState({ ds, sample: undefined, sampleIdx: 0 })
}

export async function loadAndSaveDsData(
  dsDef: DatasetDef,
  isPreview?: boolean
) {
  const load = isPreview ? dsDef.loadPreview : dsDef.loadFull
  if (load) {
    const { xTrain, yTrain, xTest, yTest, xTrainRaw, xTestRaw } = await load()
    await saveData(dsDef, "train", xTrain, yTrain, xTrainRaw)
    if (xTest && yTest) await saveData(dsDef, "test", xTest, yTest, xTestRaw)
  }
  const dsMeta = dsDefToDsMeta(dsDef, isPreview)
  const newMeta = { index: "dsMeta", ...dsMeta }
  await putData(dsDef.key, "meta", newMeta)
  return newMeta
}

function dsDefToDsMeta(dsDef: DatasetDef, isPreview?: boolean): DatasetMeta {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { loadPreview, loadFull, ...dsMeta } = dsDef
  const loaded =
    isPreview && !!dsDef.loadFull ? ("preview" as const) : ("full" as const)
  return { ...dsMeta, loaded }
}

async function saveData(
  ds: DatasetDef | Dataset,
  storeName: "train" | "test",
  xs: ParsedLike,
  ys: ParsedLike,
  xsRaw?: ParsedLike,
  overwrite = true
) {
  const { key: dbName, storeBatchSize = DEFAULT_STORE_BATCH_SIZE } = ds

  let oldSamplesX = 0
  if (overwrite) {
    await deleteAll(dbName, storeName)
  } else {
    const existingMeta = await getData<StoreMeta>(dbName, "meta", storeName)
    oldSamplesX = existingMeta?.totalSamples ?? 0
  }

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
  ds: Dataset | DatasetDef,
  xs: ParsedLike,
  ys: ParsedLike,
  xsRaw?: ParsedLike
) {
  const newTrainMeta = await saveData(ds, "train", xs, ys, xsRaw, false)
  return newTrainMeta
}

export async function resetData(dsKey: string, storeName: "train" | "test") {
  await deleteAll(dsKey, storeName)
  const storeMeta = newStoreMeta(storeName, 0)
  await putData(dsKey, "meta", storeMeta)

  /* const currDs = useGlobalStore.getState().ds
  if (currDs?.key === dsKey) {
    const newDs = { ...currDs, [storeName]: storeMeta }
    useGlobalStore.setState({ ds: newDs, skipModelCreate: true })
  } */
}
