import { useState, useCallback, useEffect } from "react"
import * as tf from "@tensorflow/tfjs"
import { button, useControls } from "leva"

import { Dataset } from "./datasets"
import { useStatusText } from "@/components/status-text"
import { lossPlot } from "@/components/loss-plot"
import { CustomInput } from "leva/plugin"

let shouldInterrupt = false

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
    batchSize: { value: 64, min: 1, max: 64, step: 1 },
    epochs: { value: 1, min: 1, max: 50, step: 1 },
    silent: { value: false },
  })

  const [, set] = useControls("training", () => ({
    lossHistory: lossPlot({
      value: [] as number[],
      label: "lossHistory",
    }) as CustomInput<number[]>,
  }))

  const setLossHistory = useCallback(
    (lh: number[]) => {
      set({ lossHistory: lh })
    },
    [set]
  )
  useEffect(() => {
    setLossHistory([])
  }, [model, setLossHistory])

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
    const { batchSize, epochs, silent } = trainingConfig
    const inputs = ds.trainData
    const labels = ds.trainLabels
    async function startTraining() {
      if (!model) return
      let startTime = Date.now()
      let epochCount = 0
      const lossValues: number[] = []
      setLossHistory([])
      const totalBatches = Math.ceil(inputs.length / batchSize)
      const callbacks: tf.ModelFitArgs["callbacks"] = {
        onBatchBegin: (batchIndex) => {
          const isLast =
            batchIndex === totalBatches - 1 && epochCount === epochs - 1
          const remainingSamples = inputs.length - batchIndex * batchSize
          const step = isLast ? remainingSamples - 1 : batchSize
          if (!silent) next(step)
        },
        onBatchEnd: (batchIndex, logs) => {
          const loss = logs?.loss
          if (typeof loss === "number") lossValues.push(loss)
          setLossHistory([...lossValues])
          setStatusText(`Training ...<br/>
Epoch ${epochCount + 1}/${epochs}<br/>
Batch ${batchIndex + 1}/${totalBatches}`)
          if (shouldInterrupt) model.stopTraining = true
        },
        onEpochBegin: (epoch) => {
          epochCount = epoch
        },
        onTrainBegin: () => {
          startTime = Date.now()
        },
        onTrainEnd: async () => {
          const endTime = Date.now()
          const totalTime = (endTime - startTime) / 1000
          setIsTraining(false)
          if (silent) next(inputs.length - 1) // update view
          setLossHistory(lossValues)
          const { accuracy, loss } = await getModelEvaluation(model, ds)
          setStatusText(
            `Training finished<br/>Loss: ${loss.toFixed(
              4
            )}<br/>Accuracy: ${accuracy?.toFixed(4)}<br/>Time: ${totalTime}s`
          )
        },
      }
      await train(model, inputs, labels, batchSize, epochs, callbacks)
    }
    startTraining()
    return () => {
      shouldInterrupt = true
      model.stopTraining = true
    }
  }, [
    model,
    isTraining,
    next,
    setStatusText,
    trainingConfig,
    ds,
    setLossHistory,
  ])

  useManualTraining(model, input, next)

  return isTraining
}

export function useManualTraining(
  model: tf.LayersModel | null,
  input: number[],
  next: () => void
) {
  useEffect(() => {
    if (!model) return
    const onKeydown = async (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        const pressedNumber = parseInt(e.key)
        await train(model, [input], [pressedNumber])
        next()
      }
    }
    window.addEventListener("keydown", onKeydown)
    return () => {
      window.removeEventListener("keydown", onKeydown)
    }
  }, [input, model, next])
}

async function train(
  model: tf.LayersModel,
  inputs: number[][],
  labels: number[],
  batchSize = 1,
  epochs = 1,
  callbacks?: tf.ModelFitArgs["callbacks"]
) {
  // TODO: interrupt ongoing training if necessary

  const X = tf.tensor(inputs)
  const numClasses = 10
  const y = tf.oneHot(labels, numClasses)
  if (!isModelCompiled(model)) {
    model.compile({
      optimizer: "adam", // Adam optimizer
      loss: "categoricalCrossentropy", // Loss function (for multi-class classification)
      metrics: ["accuracy"], // Track accuracy during training
    })
  }
  await model
    .fit(X, y, {
      batchSize,
      epochs,
      callbacks,
    })
    .catch(console.error)
}

function isModelCompiled(model: tf.LayersModel) {
  return model.loss !== undefined && model.optimizer !== undefined
}

async function getModelEvaluation(model: tf.LayersModel, ds: Dataset) {
  const X = tf.tensor(ds.testData)
  const y = tf.oneHot(ds.testLabels, 10)
  const result = await model.evaluate(X, y, { batchSize: 32 })
  const loss = (Array.isArray(result) ? result[0] : result).dataSync()[0]
  const accuracy = Array.isArray(result) ? result[1].dataSync()[0] : undefined
  return { loss, accuracy }
}
