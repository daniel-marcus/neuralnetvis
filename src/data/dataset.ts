import * as tf from "@tensorflow/tfjs"
import { useGlobalStore, useSceneStore } from "@/store"
import { datasets } from "./datasets"
import { deleteAll, getAll, getData, putData, putDataBatches } from "./db"
import type {
  Dataset,
  DatasetDef,
  DatasetMeta,
  DbBatch,
  ParsedLike,
  PreprocessFunc,
  StoreMeta,
} from "./types"
import { preprocessFuncs } from "./preprocess"
import { useEffect, useMemo, useState } from "react"

export const DEFAULT_STORE_BATCH_SIZE = 100

export function useDataset(dsDef?: DatasetDef, isPreview?: boolean) {
  const ds = useSceneStore((s) => s.ds)
  const setDs = useSceneStore((s) => s.setDs)
  const shouldLoadFullDs = useSceneStore((s) => s.shouldLoadFullDs)
  const setLoadFullDs = useSceneStore((s) => s.setLoadFullDs)
  useEffect(() => {
    async function loadDs() {
      if (!dsDef) return
      const ds = await getDsFromDef(dsDef, isPreview, shouldLoadFullDs)
      setDs(ds)
      if (shouldLoadFullDs && ds.loaded === "full") {
        setLoadFullDs(false)
      }
    }
    loadDs()
  }, [dsDef, isPreview, setDs, shouldLoadFullDs, setLoadFullDs])
  return ds
}

export function useDsDef(dsKey?: string): DatasetDef | DatasetMeta | undefined {
  const dsDef = useMemo(() => datasets.find((d) => d.key === dsKey), [dsKey])
  const [dsMetaFromDb, setDsMeta] = useState<DatasetMeta | undefined>(undefined)
  useEffect(() => {
    if (dsKey) getDsMetaFromDb(dsKey).then(setDsMeta)
  }, [dsKey])
  return dsDef || dsMetaFromDb
}

export function getDsPath(dsDef: DatasetDef | DatasetMeta) {
  if (dsDef.parentKey) {
    const params = new URLSearchParams({ ds: dsDef.key })
    return `/play/${dsDef.parentKey}?${params.toString()}`
  } else return `/play/${dsDef.key}`
}

export async function getDsMetaFromDb(key: string) {
  const dsMeta = await getData<DatasetMeta>(key, "meta", "dsMeta")
  return dsMeta
}

function newStoreMeta(
  storeName: "train" | "test",
  totalSamples = 0,
  yMean?: number
): StoreMeta {
  return { index: storeName, totalSamples, yMean }
}

export async function getDsFromDef(
  dsDef: DatasetDef | DatasetMeta,
  isPreview?: boolean,
  shouldLoadFullDs?: boolean
) {
  const existingMeta = await getData<DatasetMeta>(dsDef.key, "meta", "dsMeta")
  const hasLatestData =
    existingMeta?.version.getTime() === dsDef.version.getTime()
  const needsFullLoad =
    shouldLoadFullDs && existingMeta?.loaded !== "full" && !isPreview
  const skipLoading = existingMeta && hasLatestData && !needsFullLoad

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
  const funcName = dsDef.preprocessFunc
  if (!funcName) return
  const func = preprocessFuncs[funcName]
  return ((inp) => func(inp, dsDef.inputDims)) as PreprocessFunc
}

export async function loadAndSaveDsData(
  dsDef: DatasetDef,
  isPreview?: boolean
) {
  const load = isPreview ? dsDef.loadPreview : dsDef.loadFull
  if (load) {
    const { xTrain, yTrain, xTest, yTest, xTrainRaw, xTestRaw, xTrainNames } =
      await load()
    await saveData(dsDef, "train", xTrain, yTrain, xTrainRaw, xTrainNames)
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
  sampleNames?: string[],
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
      sampleNames: sampleNames?.slice(i, i + storeBatchSize),
    }
    batches.push(batch)
  }

  await putDataBatches(dbName, storeName, batches)

  const totalSamples = oldSamplesX + newSamplesX
  const yMean =
    ds.task === "regression" ? getMean(Array.from(ys.data)) : undefined
  const storeMeta = newStoreMeta(storeName, totalSamples, yMean)
  await putData<StoreMeta>(dbName, "meta", storeMeta)
  return storeMeta
}

function getMean(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

export async function addTrainData(
  ds: Dataset | DatasetDef,
  xs: ParsedLike,
  ys: ParsedLike,
  xsRaw?: ParsedLike
) {
  const newTrainMeta = await saveData(
    ds,
    "train",
    xs,
    ys,
    xsRaw,
    undefined,
    false
  )
  return newTrainMeta
}

export async function resetData(dsKey: string, storeName: "train" | "test") {
  await deleteAll(dsKey, storeName)
  const storeMeta = newStoreMeta(storeName, 0)
  await putData(dsKey, "meta", storeMeta)

  const scene = useGlobalStore.getState().scene
  const currDs = scene.getState().ds
  if (currDs && currDs.key === dsKey) {
    const newDs = { ...currDs, [storeName]: storeMeta }
    scene.setState({ ds: newDs, skipModelCreate: true })
  }
}

export async function getDbDataAsTensors(
  ds: Dataset,
  type: "train" | "test",
  range?: IDBKeyRange,
  returnRaw?: boolean
) {
  const batches = await getAll<DbBatch>(ds.key, type, range)
  if (!batches.length) return
  const isClassification = ds.task === "classification"
  return tf.tidy(() => {
    const xBatchTensors = batches.map((b) => tf.tensor(b.xs))
    const shapeX = [-1, ...ds.inputDims] // -1 for unknown batch size
    const _X = tf.concat(xBatchTensors).reshape(shapeX)
    const X = ds.preprocess?.(_X) ?? _X
    const yArr = batches.flatMap((b) => Array.from(b.ys))
    const y = isClassification
      ? tf.oneHot(yArr, ds.outputLabels.length)
      : tf.tensor(yArr)
    const XRaw = batches.find((b) => !!b.xsRaw)
      ? tf.concat(batches.map((b) => tf.tensor(b.xsRaw!))).reshape(shapeX)
      : undefined
    return returnRaw ? { X, y, XRaw } : { X, y }
  })
}
