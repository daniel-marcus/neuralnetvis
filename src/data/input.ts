import { useCallback, useEffect } from "react"
import { Dataset, DbBatch, useDatasetStore } from "./datasets"
import { useKeyCommand } from "@/lib/utils"
import { getData } from "./indexed-db"
import * as tf from "@tensorflow/tfjs"

export function useInput(ds?: Dataset) {
  const i = useDatasetStore((s) => s.i)

  useEffect(() => {
    if (ds) updateInput(i, ds)
  }, [i, ds])

  useEffect(() => {
    return () => {
      currBatchCache = {}
    }
  }, [ds])

  const next = useDatasetStore((s) => s.next)
  const prev = useCallback(() => next(-1), [next])
  useKeyCommand("ArrowLeft", prev)
  useKeyCommand("ArrowRight", next)
}

async function updateInput(i: number, ds?: Dataset) {
  if (!ds) return
  const [data, label, dataRaw] = await getSample(ds, "train", i, true)
  const _input = Array.from(data)
  const rawInput = dataRaw ? Array.from(dataRaw) : _input
  await tf.ready()
  const input = tf.tidy(
    () =>
      (ds.input?.preprocess?.(tf.tensor(data)).arraySync() as number[]) ??
      _input
  )
  const trainingY = label
  useDatasetStore.setState({ input, rawInput, trainingY })
}

type BatchCacheKey = string // `${ds.key}_${type}`
let currBatchCache: Record<BatchCacheKey, DbBatch> = {}

export async function getSample(
  ds: Dataset,
  type: "train" | "test",
  i: number,
  returnRaw = false
) {
  const { storeBatchSize, valsPerSample } = ds[type]
  const batchIdx = Math.floor(i / storeBatchSize)
  const batchCacheKey: BatchCacheKey = `${ds.key}_${type}`
  const hasCached = currBatchCache[batchCacheKey]?.index === batchIdx
  const batch = hasCached
    ? currBatchCache[batchCacheKey]
    : await getData<DbBatch>(ds.key, type, batchIdx)
  if (!batch) return []
  if (!hasCached) currBatchCache = { [batchCacheKey]: batch }
  const sampleIdx = i % storeBatchSize
  const sliceIdxs = [sampleIdx * valsPerSample, (sampleIdx + 1) * valsPerSample]
  const X = batch.xs.slice(...sliceIdxs)
  const XRaw = batch.xsRaw?.slice(...sliceIdxs)
  const y = batch.ys[sampleIdx]
  return returnRaw ? ([X, y, XRaw] as const) : ([X, y] as const)
}
