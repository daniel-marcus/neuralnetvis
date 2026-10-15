import { useEffect, useMemo, useRef } from "react"
import { clearStatus, setStatus, useGlobalStore } from "@/store"
import { trainOnBatch } from "@/model/training"
import type { OnScrollProps } from "./types"

const STATUS_ID = "scroll-training"

interface ScrollTrainingOptions {
  totalSamples: number // trained samples at the end of the block
  batchSize?: number // samples per training step
}

/**
 * Scroll-driven training: the scroll position within the block sets a target number of trained
 * samples, training runs (one step at a time) until the target is reached, independent of the scroll
 * speed. Training progress is derived from the scene's batchCount, which resets with the model.
 * Returns the callbacks for a <Block> plus helpers for other blocks.
 */
export function useScrollTraining({ totalSamples, batchSize = 1 }: ScrollTrainingOptions) {
  const state = useRef({
    target: 0,
    isRunning: false,
    inBlock: false,
    gen: 0, // incremented on reset to stop a running training
    onDone: [] as (() => void)[],
  })

  const training = useMemo(() => {
    const s = state.current
    const getScene = () => useGlobalStore.getState().scene.getState()
    const getTrained = () => getScene().batchCount * batchSize

    // only one training loop at a time: it checks the (updated) target after every step
    async function run() {
      if (s.isRunning) return new Promise<void>((resolve) => s.onDone.push(resolve))
      s.isRunning = true
      const gen = s.gen
      try {
        while (gen === s.gen && getTrained() < s.target) {
          const { ds, setSampleIdx } = getScene()
          if (!ds) break
          const batchesInDs = Math.max(1, Math.floor(ds.train.totalSamples / batchSize))
          const batchIdx = getScene().batchCount % batchesInDs
          setSampleIdx(batchIdx * batchSize) // show (the first sample of) the current batch
          const log = await trainOnBatch(batchIdx, batchSize)
          if (!log) break
          if (gen !== s.gen) break // reset in the meantime
          const percent = Math.min(getTrained() / totalSamples, 1)
          setStatus(`Training loss: ${log.loss.toFixed(2)}`, percent, { id: STATUS_ID })
        }
      } catch (e) {
        console.warn("Scroll training aborted", e)
      } finally {
        s.isRunning = false
        if (!s.inBlock) clearStatus(STATUS_ID)
        s.onDone.splice(0).forEach((resolve) => resolve())
      }
    }

    // trains until the given number of samples is reached, resolves when done
    function trainUntil(target: number) {
      s.target = target
      return run()
    }

    return {
      onEnter: () => {
        s.inBlock = true
      },
      onScroll: ({ percent }: OnScrollProps) => {
        trainUntil(Math.round(percent * totalSamples))
      },
      onLeave: () => {
        s.inBlock = false
        if (!s.isRunning) clearStatus(STATUS_ID)
      },
      /** for blocks after the training: make sure the model is fully trained (e.g. after fast scrolling) */
      ensureTrained: () => trainUntil(totalSamples),
      /** for blocks before the training: stop the training and reset to an untrained model */
      reset: () => {
        if (!s.isRunning && getTrained() === 0) return
        s.gen++
        s.target = 0
        clearStatus(STATUS_ID)
        getScene().resetWeights()
      },
    }
  }, [totalSamples, batchSize])

  useEffect(() => {
    const s = state.current
    return () => {
      s.gen++ // stop training when leaving the lesson
      clearStatus(STATUS_ID)
    }
  }, [])

  return training
}
