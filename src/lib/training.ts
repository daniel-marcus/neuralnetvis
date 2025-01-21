import { useState, useCallback, useEffect } from "react"
import * as tf from "@tensorflow/tfjs"
import { button, useControls } from "leva"

import { Dataset } from "./datasets"
import { useStatusText } from "@/components/status-text"
import {
  TrainingLog,
  TrainingLogSetter,
  logsPlot,
  useLogStore,
} from "@/components/logs-plot"

let epochCount = 0
let sessionEpochCount = 0

export function useTraining(
  model: tf.LayersModel | null,
  input: number[], // only for manual training
  next: (step?: number) => void,
  ds: Dataset
) {
  const [isTraining, setIsTraining] = useState(false)
  const toggleTraining = useCallback(() => setIsTraining((t) => !t), [])

  const setStatusText = useStatusText((s) => s.setStatusText)

  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName.toLowerCase() === "input") return
      if (e.key === "t") toggleTraining()
      if (e.key === "b") {
        const backend = tf.getBackend()
        const newBackend = backend === "webgl" ? "cpu" : "webgl"
        tf.setBackend(newBackend)
        setStatusText(`Switched backend to ${newBackend}`)
      }
    }
    window.addEventListener("keydown", onKeydown)
    return () => {
      window.removeEventListener("keydown", onKeydown)
    }
  }, [toggleTraining, setStatusText])

  const trainingConfig = useControls("training", {
    validationSplit: {
      label: "validSplit",
      value: 0.1,
      min: 0,
      max: 0.5,
      step: 0.1,
    },
    batchSize: { value: 128, min: 1, max: 512, step: 1 },
    epochs: { value: 3, min: 1, max: 100, step: 1 },
    silent: false,
  })

  useEffect(() => {
    if (!trainingPromise)
      setStatusText(
        trainingConfig.silent
          ? "Silent mode activated.<br/>Graphics will upate only after training."
          : "Silent mode deactivated.<br/>Graphics will update during training."
      )
  }, [trainingConfig.silent, setStatusText])

  useControls("training", () => ({
    logs: logsPlot(),
  }))

  const setLogs = useLogStore((s) => s.setLogs)

  useEffect(() => {
    setLogs([] as TrainingLog[])
    setIsTraining(false)
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

  useEffect(() => {
    epochCount = 0
  }, [model])

  useEffect(() => {
    if (!isTraining || !model) {
      trainingPromise = null
      return
    }
    const {
      validationSplit,
      batchSize,
      epochs: _epochs,
      silent,
    } = trainingConfig
    const inputs = ds.data.trainX
    const labels = ds.data.trainY
    const trainSampleSize = Math.floor(inputs.length * (1 - validationSplit))
    const isNewSession = !trainingPromise
    if (isNewSession) sessionEpochCount = 0
    const initialEpoch = epochCount > 0 ? epochCount : 0
    const epochs = initialEpoch + _epochs - sessionEpochCount
    async function startTraining() {
      if (!model) return
      let startTime = Date.now()
      const totalBatches = Math.ceil(trainSampleSize / batchSize)
      const isLastBatch = (batchIndex: number) =>
        batchIndex === totalBatches - 1
      const isLastEpoch = () => epochCount === epochs - 1
      let trainingComplete = false
      const callbacks: tf.ModelFitArgs["callbacks"] = {
        onBatchBegin: (batchIndex) => {
          const remainingSamples = trainSampleSize - batchIndex * batchSize
          const step =
            isLastEpoch() && isLastBatch(batchIndex)
              ? remainingSamples - 1 // stop on last sample
              : isLastBatch(batchIndex)
              ? remainingSamples % batchSize
              : batchSize
          if (!silent) next(step)
        },
        onBatchEnd: (batchIndex, logs) => {
          if (isLastBatch(batchIndex)) sessionEpochCount++
          if (isLastEpoch() && isLastBatch(batchIndex)) trainingComplete = true
          if (typeof logs !== "undefined")
            setLogs((prev) => [...prev, { epoch: epochCount, ...logs }])
          setStatusText(`Training ...<br/>
Epoch ${epochCount + 1}/${epochs}<br/>
Batch ${batchIndex + 1}/${totalBatches}`)
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
          if (silent) next(trainSampleSize - 1) // update view
          const { accuracy, loss } = await getModelEvaluation(model, ds)
          const backend = tf.getBackend()
          if (!trainingPromise || trainingComplete)
            setStatusText(
              `Training finished (${backend})<br/>Loss: ${loss.toFixed(
                4
              )}<br/>Accuracy: ${accuracy?.toFixed(4)}<br/>Time: ${totalTime}s`
            )
          if (trainingComplete) {
            epochCount++
            trainingPromise = null
            setIsTraining(false)
          }
        },
      }
      const options = {
        batchSize,
        epochs,
        validationSplit,
        callbacks,
        initialEpoch,
      }
      await train(model, inputs, labels, options, ds.output, ds.loss)
    }
    startTraining()
    return () => {
      model.stopTraining = true
    }
  }, [model, isTraining, next, setStatusText, trainingConfig, ds, setLogs])

  useManualTraining(model, input, next, setLogs, ds)

  return isTraining
}

export function useManualTraining(
  model: tf.LayersModel | null,
  input: number[],
  next: () => void,
  setLogs: TrainingLogSetter,
  ds: Dataset
) {
  useEffect(() => {
    if (!model) return
    const onKeydown = async (e: KeyboardEvent) => {
      if (document.activeElement?.tagName.toLowerCase() === "input") return
      if (e.key >= "0" && e.key <= "9") {
        const pressedNumber = parseInt(e.key)
        const callbacks: tf.ModelFitArgs["callbacks"] = {
          onBatchEnd: (_, logs) => {
            if (typeof logs !== "undefined")
              setLogs((prev) => [...prev, { ...logs, epoch: -1, batch: -1 }])
          },
        }
        const options = {
          batchSize: 1,
          epochs: 1,
          validationSplit: 0,
          callbacks,
        }
        // TODO: use tf trainOnBatch method?
        await train(
          model,
          [input],
          [pressedNumber],
          options,
          ds.output,
          ds.loss
        )
        next()
      }
    }
    window.addEventListener("keydown", onKeydown)
    return () => {
      window.removeEventListener("keydown", onKeydown)
    }
  }, [input, model, next, setLogs, ds])
}

const defaultOptions: tf.ModelFitArgs = {
  batchSize: 1,
  epochs: 1,
  validationSplit: 0,
  shuffle: true,
}

let trainingPromise: Promise<tf.History | void> | null = null

async function train(
  model: tf.LayersModel,
  inputs: number[][],
  trainY: number[],
  options: tf.ModelFitArgs = {},
  output: Dataset["output"],
  lossFunction: Dataset["loss"] = "categoricalCrossentropy"
) {
  if (trainingPromise) {
    console.log("Changing ongoing training ...")
    await trainingPromise
    trainingPromise = null
  }
  options = { ...defaultOptions, ...options }
  const X = tf.tensor(inputs)
  const y = getY(trainY, output)
  if (!isModelCompiled(model)) {
    model.compile({
      optimizer: tf.train.adam(),
      loss: lossFunction,
      metrics: ["accuracy"],
    })
  }
  trainingPromise = model.fit(X, y, options).catch(console.error)
  const history = await trainingPromise
  X.dispose()
  y.dispose()
  return history
}

function getY(trainY: number[], output: Dataset["output"]) {
  return output.activation === "softmax"
    ? tf.oneHot(trainY, output.size)
    : tf.tensor(trainY)
}

function isModelCompiled(model: tf.LayersModel) {
  return model.loss !== undefined && model.optimizer !== undefined
}

async function getModelEvaluation(model: tf.LayersModel, ds: Dataset) {
  const X = tf.tensor(ds.data.testX)
  const y = getY(ds.data.testY, ds.output)
  const result = model.evaluate(X, y, { batchSize: 64 })
  const loss = (Array.isArray(result) ? result[0] : result).dataSync()[0]
  const accuracy = Array.isArray(result) ? result[1].dataSync()[0] : undefined
  X.dispose()
  y.dispose()
  return { loss, accuracy }
}
