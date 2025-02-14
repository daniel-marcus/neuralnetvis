import { useEffect } from "react"
import { create } from "zustand"
import { useStatusStore } from "@/components/status"
import { datasets } from "./datasets"
import { getData, putData, putDataBatches } from "./db"
import type {
  Dataset,
  DatasetDef,
  DbBatch,
  ParsedLike,
  StoreMeta,
} from "./types"

type Sample = {
  X: number[]
  y: number
  rawX?: number[]
}

interface DatasetStore {
  datasetKey: string | undefined
  setDatasetKey: (key: string) => void
  ds: Dataset | undefined
  setDs: (ds: Dataset | undefined) => void
  totalSamples: number
  isRegression: boolean

  sampleIdx: number
  setSampleIdx: (arg: number | ((prev: number) => number)) => void
  next: (step?: number) => void
  sample?: Sample
  reset: () => void
}

export const useDatasetStore = create<DatasetStore>((set) => ({
  datasetKey: undefined,
  setDatasetKey: (key) => set({ datasetKey: key }),
  ds: undefined,
  setDs: (ds) =>
    set(() => {
      const totalSamples = ds?.train.shapeX[0] ?? 0
      // const i = Math.floor(Math.random() * totalSamples - 1) // TODO update i in sample store
      const isRegression = ds?.task === "regression"
      return { ds, totalSamples, isRegression }
    }),
  totalSamples: 0,
  isRegression: false,

  sampleIdx: 0,
  setSampleIdx: (arg) =>
    set(({ sampleIdx }) => {
      return { sampleIdx: typeof arg === "function" ? arg(sampleIdx) : arg }
    }),
  next: (step = 1) =>
    set(({ sampleIdx, totalSamples }) => {
      return {
        sampleIdx: (sampleIdx + step + totalSamples) % totalSamples,
      }
    }),
  sample: undefined,
  reset: () => set(() => ({ sampleIdx: 0, sample: undefined })),
}))

export function useDataset() {
  const datasetKey = useDatasetStore((s) => s.datasetKey)
  const ds = useDatasetStore((s) => s.ds)
  const setDs = useDatasetStore((s) => s.setDs)
  const setStatusText = useStatusStore((s) => s.setStatusText)

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
        setDs({
          ...dsDef,
          train,
          test,
        })
      } else {
        console.log("loading new data into indexedDB ...")
        await loadAndSaveDsData(dsDef)
        const train = await getData<StoreMeta>(dsDef.key, "meta", "train") // TODO: type keys
        const test = await getData<StoreMeta>(dsDef.key, "meta", "test")
        if (!train || !test) {
          throw new Error("Failed to create indexedDB store")
        }
        setDs({
          ...dsDef,
          train,
          test,
        })
      }
    }

    return () => {
      setDs(undefined)
    }
  }, [datasetKey, setStatusText, setDs])

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
