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
import { useSearchParams } from "next/navigation"
import { tokenizers, TokenizerType } from "./tokenizer"

export const DEFAULT_STORE_BATCH_SIZE = 100

export function useDataset(dsDef?: DatasetDef) {
  const isPreview = useSceneStore((s) => !s.isActive)
  const ds = useSceneStore((s) => s.ds)
  const setDs = useSceneStore((s) => s.setDs)
  const shouldLoadFullDs = useSceneStore((s) => s.shouldLoadFullDs)
  const setLoadFullDs = useSceneStore((s) => s.setLoadFullDs)
  useEffect(() => {
    async function loadDs() {
      if (!dsDef) return
      const ds = await getDsFromDef(dsDef, isPreview, shouldLoadFullDs)
      setDs(ds, true)
      if (shouldLoadFullDs && ds.loaded === "full") {
        setLoadFullDs(false)
      }
    }
    loadDs()
  }, [dsDef, isPreview, setDs, shouldLoadFullDs, setLoadFullDs])
  useSampleViewerIdxs()
  return ds
}

function useSampleViewerIdxs() {
  const ds = useSceneStore((s) => s.ds)
  const setSampleViewerIdxs = useSceneStore((s) => s.setSampleViewerIdxs)
  const subset = useSceneStore((s) => s.subset)
  useEffect(() => {
    if (!ds || !ds.sampleViewer) return
    const totalSamples = ds[subset].totalSamples
    const idxs = Array.from({ length: totalSamples }, (_, i) => i)
    setSampleViewerIdxs(idxs)
    return () => setSampleViewerIdxs([])
  }, [ds, subset])
}

export function useDsDef(dsKey?: string) {
  const isActive = useSceneStore((s) => s.isActive)
  const dsKeyFromParams = useSearchParams().get("ds")
  const dsDef = useMemo(() => datasets.find((d) => d.key === dsKey), [dsKey])
  const [dsMetaFromDb, setDsMeta] = useState<DatasetMeta | undefined>(undefined)
  useEffect(() => {
    if (!isActive || !dsKeyFromParams) return
    getDsMetaFromDb(dsKeyFromParams).then(setDsMeta)
    return () => setDsMeta(undefined)
  }, [isActive, dsKeyFromParams])
  return isActive ? dsMetaFromDb ?? dsDef : dsDef
}

export function getDsPath(dsDef: DatasetDef | DatasetMeta) {
  if (datasets.find((d) => d.key === dsDef.key)) {
    return `/play/${dsDef.key}`
  } else {
    const params = new URLSearchParams({ ds: dsDef.key })
    // mnist as fallback just to open one of the existing tiles
    return `/play/${dsDef.parentKey ?? "mnist"}?${params.toString()}`
  }
}

export async function getDsMetaFromDb(key: string) {
  const dsMeta = await getData<DatasetMeta>(key, "meta", "dsMeta")
  return dsMeta
}

function newStoreMeta(
  storeName: "train" | "test",
  totalSamples = 0,
  aspectRatio?: number
): StoreMeta {
  return { index: storeName, totalSamples, aspectRatio }
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
  const shouldLoad = !hasLatestData || !!needsFullLoad

  let newMeta: DatasetMeta | undefined
  if (shouldLoad) {
    newMeta = await loadAndSaveDsData(dsDef, isPreview)
  }

  const { key } = dsDef
  const train =
    (await getData<StoreMeta>(key, "meta", "train")) ?? newStoreMeta("train")
  const test =
    (await getData<StoreMeta>(key, "meta", "test")) ?? newStoreMeta("test")
  const storeBatchSize = dsDef.storeBatchSize || DEFAULT_STORE_BATCH_SIZE
  const preprocess = getPreprocessFunc(dsDef)
  const tokenizer = await getTokenizer(dsDef)
  const ds: Dataset = {
    ...dsDef,
    train,
    test,
    preprocess,
    tokenizer,
    storeBatchSize,
    loaded: newMeta?.loaded ?? existingMeta?.loaded ?? "preview",
  }
  return ds
}

function getPreprocessFunc(dsDef: DatasetDef | DatasetMeta) {
  const funcName = dsDef.preprocessFunc
  if (!funcName) return
  const func = preprocessFuncs[funcName]
  return ((inp) => func(inp, dsDef.inputDims)) as PreprocessFunc
}

async function getTokenizer(dsDef: DatasetDef | DatasetMeta) {
  const tokenizerName = dsDef.tokenizerName
  if (!tokenizerName) return
  const Tokenizer = tokenizers[tokenizerName]
  const tokenizer = new Tokenizer() as TokenizerType
  if (tokenizer.init) await tokenizer.init()
  return tokenizer
}

export async function loadAndSaveDsData(
  dsDef: DatasetDef,
  isPreview?: boolean
) {
  const load = isPreview ? dsDef.loadPreview : dsDef.loadFull
  if (load) {
    const {
      xTrain,
      yTrain,
      xTest,
      yTest,
      xTrainRaw,
      xTestRaw,
      xTrainNames,
      xTestNames,
    } = await load()
    await saveData(dsDef, "train", xTrain, yTrain, xTrainRaw, xTrainNames)
    if (xTest && yTest)
      await saveData(dsDef, "test", xTest, yTest, xTestRaw, xTestNames)
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
  overwrite = true,
  aspectRatio?: number
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
  aspectRatio = aspectRatio ?? ds.camProps?.aspectRatio
  const storeMeta = newStoreMeta(storeName, totalSamples, aspectRatio)
  await putData<StoreMeta>(dbName, "meta", storeMeta)
  return storeMeta
}

export async function addTrainData(
  ds: Dataset | DatasetDef,
  xs: ParsedLike,
  ys: ParsedLike,
  xsRaw?: ParsedLike,
  aspectRatio?: number
) {
  const newTrainMeta = await saveData(
    ds,
    "train",
    xs,
    ys,
    xsRaw,
    undefined,
    false,
    aspectRatio
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

interface GetDbDataOpts {
  range?: IDBKeyRange
  returnRawX?: boolean
  noOneHot?: boolean
}

export async function getDbDataAsTensors(
  ds: Dataset,
  type: "train" | "test",
  opts: GetDbDataOpts = {}
) {
  const { range, returnRawX, noOneHot } = opts
  const batches = await getAll<DbBatch>(ds.key, type, range)
  if (!batches.length) return
  const isClassification = ds.task === "classification"
  await tf.ready()
  return tf.tidy(() => {
    const xBatchTensors = batches.map((b) => tf.tensor(b.xs))
    const shapeX = [-1, ...ds.inputDims] // -1 for unknown batch size
    const _X = tf.concat(xBatchTensors).reshape(shapeX)
    const X = ds.preprocess?.(_X) ?? _X
    const yBatches = batches.map((b) => tf.tensor(b.ys))
    const yTensor = tf.concat(yBatches)
    const y =
      isClassification && !noOneHot
        ? tf.oneHot(yTensor, ds.outputLabels.length)
        : yTensor
    const XRaw =
      returnRawX && batches.find((b) => !!b.xsRaw)
        ? tf.concat(batches.map((b) => tf.tensor(b.xsRaw!))).reshape(shapeX)
        : undefined
    return { X, y, XRaw }
  })
}
