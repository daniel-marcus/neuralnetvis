import { useState, useCallback, useEffect } from "react"
import * as tf from "@tensorflow/tfjs"
import { button, useControls } from "leva"

import { Dataset } from "./datasets"
import { useStatusText } from "@/components/status-text"
import { TrainingLog, logsPlot } from "@/components/logs-plot"
import { CustomInput } from "leva/plugin"

let shouldInterrupt = false

type TrainingLogSetter = (
  arg: TrainingLog[] | ((prev: TrainingLog[]) => TrainingLog[])
) => void

export function useTraining(
  model: tf.LayersModel | null,
  input: number[], // only for manual training
  next: (step?: number) => void,
  ds: Dataset
) {
  const [isTraining, setIsTraining] = useState(false)
  const toggleTraining = useCallback(
    () =>
      setIsTraining((t) => {
        shouldInterrupt = t
        return !t
      }),
    []
  )
  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === "t") toggleTraining()
    }
    window.addEventListener("keydown", onKeydown)
    return () => {
      window.removeEventListener("keydown", onKeydown)
    }
  }, [toggleTraining])

  const trainingConfig = useControls("training", {
    validationSplit: {
      label: "validSplit",
      value: 0.1,
      min: 0,
      max: 0.5,
      step: 0.1,
    },
    batchSize: { value: 128, min: 1, max: 512, step: 1 },
    epochs: { value: 3, min: 1, max: 50, step: 1 },
    silent: false,
  })

  const [, set, get] = useControls("training", () => ({
    logs: logsPlot({
      value: [] as TrainingLog[],
      label: "logs",
    }) as CustomInput<TrainingLog[]>,
  }))

  const setLogs: TrainingLogSetter = useCallback(
    (arg) => {
      const newVal = typeof arg === "function" ? arg(get("logs")) : arg
      set({ logs: newVal })
    },
    [set, get]
  )

  useEffect(() => {
    setLogs([] as TrainingLog[])
  }, [model, setLogs])

  useControls(
    "training",
    {
      [`${isTraining ? "Stop" : "Start"} training`]: button(() =>
        toggleTraining()
      ),
    },
    [isTraining]
  )

  const setStatusText = useStatusText((s) => s.setStatusText)

  useEffect(() => {
    if (!isTraining || !model) return
    const { validationSplit, batchSize, epochs, silent } = trainingConfig
    const inputs = ds.trainData
    const labels = ds.trainLabels
    const trainSampleSize = Math.floor(inputs.length * (1 - validationSplit))
    // TODO: implement initialEpoch?
    async function startTraining() {
      if (!model) return
      let startTime = Date.now()
      let epochCount = 0
      const totalBatches = Math.ceil(inputs.length / batchSize)
      const callbacks: tf.ModelFitArgs["callbacks"] = {
        onBatchBegin: (batchIndex) => {
          const isLastInBatch = batchIndex === totalBatches - 1
          const isLastInEpoch = isLastInBatch && epochCount === epochs - 1
          const remainingSamples = trainSampleSize - batchIndex * batchSize
          const step = isLastInEpoch
            ? remainingSamples - 1 // stop on last sample
            : isLastInBatch
            ? remainingSamples % batchSize
            : batchSize
          if (!silent) next(step)
        },
        onBatchEnd: (batchIndex, logs) => {
          if (typeof logs !== "undefined")
            setLogs((prev) => [...prev, { epoch: epochCount, ...logs }])
          setStatusText(`Training ...<br/>
Epoch ${epochCount + 1}/${epochs}<br/>
Batch ${batchIndex + 1}/${totalBatches}`)
          if (shouldInterrupt) model.stopTraining = true
        },
        onEpochBegin: (epoch) => {
          epochCount = epoch
        },
        onEpochEnd: (epoch, logs) => {
          if (typeof logs !== "undefined")
            setLogs((prev) => [...prev, { epoch, ...logs }])
        },
        onTrainBegin: () => {
          startTime = Date.now()
        },
        onTrainEnd: async () => {
          const endTime = Date.now()
          const totalTime = (endTime - startTime) / 1000
          setIsTraining(false)
          if (silent) next(trainSampleSize - 1) // update view
          const { accuracy, loss } = await getModelEvaluation(model, ds)
          setStatusText(
            `Training finished<br/>Loss: ${loss.toFixed(
              4
            )}<br/>Accuracy: ${accuracy?.toFixed(4)}<br/>Time: ${totalTime}s`
          )
        },
      }
      const options = { batchSize, epochs, validationSplit, callbacks }
      await train(model, inputs, labels, options)
    }
    startTraining()
    return () => {
      shouldInterrupt = true
      model.stopTraining = true
    }
  }, [model, isTraining, next, setStatusText, trainingConfig, ds, setLogs])

  useManualTraining(model, input, next, setLogs)

  return isTraining
}

export function useManualTraining(
  model: tf.LayersModel | null,
  input: number[],
  next: () => void,
  setLogs: TrainingLogSetter
) {
  useEffect(() => {
    if (!model) return
    const onKeydown = async (e: KeyboardEvent) => {
      /* if (e.key === "b") {
        const backend = tf.getBackend()
        const newBackend = backend === "cpu" ? "webgl" : "cpu"
        tf.setBackend(newBackend)
        console.log(`Backend switched to ${newBackend}`)
      } */
      if (e.key >= "0" && e.key <= "9") {
        if (document.activeElement?.tagName.toLowerCase() === "input") return
        const pressedNumber = parseInt(e.key)
        const callbacks: tf.ModelFitArgs["callbacks"] = {
          onBatchEnd: (_, logs) => {
            if (typeof logs !== "undefined") setLogs((prev) => [...prev, logs])
          },
        }
        const options = {
          batchSize: 1,
          epochs: 1,
          validationSplit: 0,
          callbacks,
        }
        await train(model, [input], [pressedNumber], options)
        next()
      }
    }
    window.addEventListener("keydown", onKeydown)
    return () => {
      window.removeEventListener("keydown", onKeydown)
    }
  }, [input, model, next, setLogs])
}

const defaultOptions: tf.ModelFitArgs = {
  batchSize: 1,
  epochs: 1,
  validationSplit: 0,
  shuffle: true,
}

async function train(
  model: tf.LayersModel,
  inputs: number[][],
  labels: number[],
  options: tf.ModelFitArgs = {}
) {
  // TODO: interrupt ongoing training if necessary
  options = { ...defaultOptions, ...options }
  const X = tf.tensor(inputs)
  const numClasses = 10
  const y = tf.oneHot(labels, numClasses)
  if (!isModelCompiled(model)) {
    model.compile({
      optimizer: "adam",
      loss: "categoricalCrossentropy",
      metrics: ["accuracy"],
    })
  }
  await model.fit(X, y, options).catch(console.error)
}

function isModelCompiled(model: tf.LayersModel) {
  return model.loss !== undefined && model.optimizer !== undefined
}

async function getModelEvaluation(model: tf.LayersModel, ds: Dataset) {
  const X = tf.tensor(ds.testData)
  const y = tf.oneHot(ds.testLabels, 10)
  const result = model.evaluate(X, y, { batchSize: 32 })
  const loss = (Array.isArray(result) ? result[0] : result).dataSync()[0]
  const accuracy = Array.isArray(result) ? result[1].dataSync()[0] : undefined
  return { loss, accuracy }
}
