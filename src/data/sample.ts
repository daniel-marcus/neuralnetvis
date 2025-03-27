import { useEffect, useCallback } from "react"
import * as tf from "@tensorflow/tfjs"
import { isDebug, useGlobalStore, useSceneStore } from "@/store"
import { useKeyCommand } from "@/utils/key-command"
import { getData } from "./db"
import type { Dataset, DbBatch, Sample, SampleRaw } from "./types"

export function useSample(ds?: Dataset, isActive?: boolean) {
  const backendReady = useGlobalStore((s) => s.backendReady)
  const sampleIdx = useSceneStore((s) => s.sampleIdx)
  const sample = useSceneStore((s) => s.sample)
  const setSample = useSceneStore((s) => s.setSample)
  const subset = useSceneStore((s) => s.subset)

  useEffect(() => {
    if (!backendReady) return
    async function loadSample() {
      if (!ds || typeof sampleIdx === "undefined" || isNaN(sampleIdx)) return
      const rawSample = await getSample(ds, subset, sampleIdx)
      setSample(rawSample)
    }
    loadSample()
  }, [ds, sampleIdx, setSample, backendReady, subset])

  useEffect(() => {
    return () => {
      if (sample?.xTensor) sample.xTensor.dispose()
    }
  }, [sample])

  const next = useSceneStore((s) => s.nextSample)
  const prev = useCallback(() => next(-1), [next])
  useKeyCommand("ArrowLeft", prev, isActive)
  useKeyCommand("ArrowRight", next, isActive)

  return sample
}

export function preprocessSample(sampleRaw?: SampleRaw, ds?: Dataset) {
  if (!sampleRaw || !ds) return
  const name = sampleRaw.name
  const rawX = sampleRaw.rawX ?? sampleRaw.X
  const xTensor = tf.tidy(() => {
    const tensor = tf.tensor(sampleRaw.X, [1, ...ds.inputDims])
    return ds.preprocess ? ds.preprocess(tensor) : tensor
  })
  const X = tf.tidy(() => xTensor.flatten().arraySync() as number[])
  const sample: Sample = { X, y: sampleRaw.y, rawX, xTensor, name }
  return sample
}

type BatchCacheKey = string // `${ds.key}_${type}`
let currBatchCache: Record<BatchCacheKey, DbBatch> = {}

export async function getSample(
  ds: Dataset,
  type: "train" | "test",
  i: number
) {
  const valsPerSample = ds.inputDims.reduce((a, b) => a * b)
  const storeBatchSize = ds.storeBatchSize
  const batchIdx = Math.floor(i / storeBatchSize)
  const batchCacheKey: BatchCacheKey = `${ds.key}_${type}`
  const hasCached = currBatchCache[batchCacheKey]?.index === batchIdx
  const batch = hasCached
    ? currBatchCache[batchCacheKey]
    : await getData<DbBatch>(ds.key, type, batchIdx)
  if (!batch) {
    if (isDebug()) console.log("NO BATCH", hasCached, batchIdx, i, ds)
    return
  }
  if (!hasCached) currBatchCache = { [batchCacheKey]: batch }
  const sampleIdx = i % storeBatchSize
  const sliceIdxs = [sampleIdx * valsPerSample, (sampleIdx + 1) * valsPerSample]
  const X = batch.xs.slice(...sliceIdxs)
  const rawX = batch.xsRaw?.slice(...sliceIdxs)
  const y = batch.ys[sampleIdx]
  const name = batch.sampleNames?.[sampleIdx]
  const result: SampleRaw = {
    X: Array.from(X),
    y,
    rawX: rawX ? Array.from(rawX) : undefined,
    name,
  }
  return result
}
