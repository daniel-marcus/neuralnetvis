import { useEffect, useCallback } from "react"
import * as tf from "@tensorflow/tfjs"
import { useStore } from "@/store"
import { useKeyCommand } from "@/utils/key-command"
import { getData } from "./db"
import type { Dataset, DbBatch } from "./types"

export function useSample(ds?: Dataset) {
  const sampleIdx = useStore((s) => s.sampleIdx)
  const resetSample = useStore((s) => s.resetSample)

  useEffect(() => {
    updateSample(sampleIdx)
  }, [sampleIdx, ds])

  useEffect(() => {
    if (!ds) return
    return () => {
      currBatchCache = {}
      resetSample()
    }
  }, [ds, resetSample])

  const next = useStore((s) => s.nextSample)
  const prev = useCallback(() => next(-1), [next])
  useKeyCommand("ArrowLeft", prev)
  useKeyCommand("ArrowRight", next)
}

export async function updateSample(sampleIdx: number) {
  const ds = useStore.getState().ds
  if (!ds) return
  const sample = await getPreprocessedSample(ds, sampleIdx)
  useStore.setState({ sample })
}

export async function getPreprocessedSample(ds: Dataset, sampleIdx: number) {
  const dbSample = await getSample(ds, "train", sampleIdx, true)
  const [features, y, featuresRaw] = dbSample
  if (!features) return
  const _X = Array.from(features ?? [])
  const rawX = featuresRaw ? Array.from(featuresRaw) : _X
  await tf.ready()
  const X = tf.tidy(
    () => (ds.preprocess?.(tf.tensor1d(_X)).arraySync() as number[]) ?? _X
  )
  const sample = { X, y, rawX }
  return sample
}

type BatchCacheKey = string // `${ds.key}_${type}`
let currBatchCache: Record<BatchCacheKey, DbBatch> = {}

export async function getSample(
  ds: Dataset,
  type: "train" | "test",
  i: number,
  returnRaw = false
) {
  const valsPerSample = ds.inputDims.reduce((a, b) => a * b)
  const storeBatchSize = ds.storeBatchSize
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
