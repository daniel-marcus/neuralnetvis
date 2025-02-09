import { useCallback, useEffect } from "react"
import { Dataset, DbBatch, useDatasetStore } from "./datasets"
import { useKeyCommand } from "@/lib/utils"
import { getData } from "./indexed-db"
import * as tf from "@tensorflow/tfjs"

let currBatchCache: DbBatch | null = null

export function useInput(ds?: Dataset) {
  const i = useDatasetStore((s) => s.i)

  useEffect(() => {
    // useInput
    if (!ds) return
    async function getInput() {
      if (!ds) return
      const { storeBatchSize, valsPerSample } = ds.train
      const batchIdx = Math.floor(i / storeBatchSize)
      const batch =
        currBatchCache?.index === batchIdx
          ? currBatchCache
          : await getData<DbBatch>(ds.key, "train", batchIdx)
      if (!batch) return
      const sampleIdx = i % storeBatchSize
      const data = batch.xs.slice(
        sampleIdx * valsPerSample,
        (sampleIdx + 1) * valsPerSample
      )
      const dataRaw = batch.xsRaw?.slice(
        sampleIdx * valsPerSample,
        (sampleIdx + 1) * valsPerSample
      )
      const label = batch.ys[sampleIdx]
      const _input = Array.from(data)
      const rawInput = dataRaw ? Array.from(dataRaw) : _input
      const input = tf.tidy(() =>
        ds.input?.preprocess
          ? (ds.input.preprocess(tf.tensor(data)).arraySync() as number[])
          : _input
      )
      const trainingY = label
      useDatasetStore.setState({ input, rawInput, trainingY })
    }
    getInput()
    return
  }, [i, ds])

  useEffect(() => {
    return () => {
      currBatchCache = null
    }
  }, [ds])

  const next = useDatasetStore((s) => s.next)
  const prev = useCallback(() => next(-1), [next])
  useKeyCommand("ArrowLeft", prev)
  useKeyCommand("ArrowRight", next)
}
