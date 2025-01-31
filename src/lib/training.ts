import { useState, useCallback, useEffect } from "react"
import * as tf from "@tensorflow/tfjs"
import { button, useControls } from "leva"
import { Dataset } from "./datasets"
import { useStatusText } from "@/components/status"
import { TrainingLog, logsPlot, useLogStore } from "@/components/logs-plot"
import { useControlStores } from "@/components/controls"

let epochCount = 0
let sessionEpochCount = 0
let sessionBatchCount = 0

export function useTraining(
  model: tf.LayersModel | undefined,
  ds: Dataset | undefined,
  next: (step?: number) => void
) {
  const [batchCounter, setBatchCounter] = useState(0)
  const [isTraining, setIsTraining] = useState(false)

  const toggleTraining = useCallback(() => setIsTraining((t) => !t), [])

  const setStatusText = useStatusText((s) => s.setStatusText)

  useEffect(() => {
    const onKeydown = async (e: KeyboardEvent) => {
      if (document.activeElement?.tagName.toLowerCase() === "input") return
      if (e.key === "t") toggleTraining()
      if (e.key === "b") {
        const currentBackend = tf.getBackend()
        const availableBackends = getAvailableBackends()
        const currIdx = availableBackends.indexOf(currentBackend)
        const newBackend =
          availableBackends[(currIdx + 1) % availableBackends.length]
        tf.setBackend(newBackend)
        setStatusText(`Switched backend to ${newBackend}`)
      }
    }
    window.addEventListener("keydown", onKeydown)
    return () => {
      window.removeEventListener("keydown", onKeydown)
    }
  }, [toggleTraining, setStatusText])

  const { trainStore } = useControlStores()
  const trainingConfig = useControls(
    {
      batchSize: {
        value: 256,
        min: 1,
        max: 512,
        step: 1,
      },
      epochs: { value: 3, min: 1, max: 100, step: 1 },
      validationSplit: {
        label: "validSplit",
        value: 0.1,
        min: 0,
        max: 0.5,
        step: 0.1,
      },
      silent: true,
    },
    { store: trainStore }
  )

  useControls({ logs: logsPlot() }, { store: trainStore }, [batchCounter])

  const setLogs = useLogStore((s) => s.setLogs)

  useEffect(() => {
    setBatchCounter(0)
    setLogs([] as TrainingLog[])
    setIsTraining(false)
  }, [model, setLogs])

  useControls(
    {
      [`${isTraining ? "Stop" : "Start"} training`]: button(() =>
        toggleTraining()
      ),
    },
    { store: trainStore },
    [isTraining]
  )

  useEffect(() => {
    epochCount = 0
  }, [model])

  useEffect(() => {
    if (!isTraining || !ds || !model) {
      trainingPromise = null
      return
    }
    const {
      validationSplit,
      batchSize,
      epochs: _epochs,
      silent,
    } = trainingConfig
    const totalSamples = ds.data.trainX.shape[0]
    const trainSampleSize = Math.floor(totalSamples * (1 - validationSplit))
    const isNewSession = !trainingPromise
    if (isNewSession) {
      sessionEpochCount = 0
      sessionBatchCount = 0
    }
    const initialEpoch = epochCount > 0 ? epochCount : 0
    const epochs = initialEpoch + _epochs - sessionEpochCount
    async function startTraining() {
      if (!model || !ds) return
      // use wegpu for silent training (faster)
      if (silent) await setBackendIfAvailable("webgpu")
      let startTime = Date.now()
      const epochBatches = Math.ceil(trainSampleSize / batchSize)
      const totalBatches = _epochs * epochBatches
      const isLastBatch = (batchIndex: number) =>
        batchIndex === epochBatches - 1
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
          if (!silent) {
            next(step) // trigger view update
            setBatchCounter((prev) => prev + 1) // trigger model update
          }
        },
        onBatchEnd: (batchIndex, logs) => {
          sessionBatchCount++
          const percent = sessionBatchCount / totalBatches
          if (isLastBatch(batchIndex)) sessionEpochCount++
          if (isLastEpoch() && isLastBatch(batchIndex)) trainingComplete = true
          if (typeof logs !== "undefined")
            setLogs((prev) => [...prev, { epoch: epochCount, ...logs }])
          setStatusText(
            {
              title: "Training ...",
              data: {
                Epoch: `${epochCount + 1}/${epochs}`,
                Batch: `${batchIndex + 1}/${epochBatches}`,
              },
            },
            { percent }
          )
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
          if (silent) {
            const processedSamples = trainSampleSize - 1
            next(processedSamples) // update view
            setBatchCounter((c) => c + processedSamples) // update weights
          }
          const { accuracy, loss } = await getModelEvaluation(model, ds)
          if (!trainingPromise || trainingComplete) {
            const data = {
              Loss: loss?.toFixed(3),
              Accuracy: accuracy?.toFixed(3),
              Time: `${totalTime.toFixed(2)}s`,
            }
            setStatusText(
              { title: "Training finished", data },
              { percent: null, time: 3 }
            )
          }
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
      await train(model, ds, options)
      await setBackendIfAvailable("webgl")
    }
    startTraining()
    return () => {
      model.stopTraining = true
    }
  }, [model, isTraining, next, setStatusText, trainingConfig, ds, setLogs])

  // useManualTraining(model, input, next, setLogs, ds)

  return [isTraining, batchCounter] as const
}

/* export function useManualTraining(
  model: tf.LayersModel | null,
  input: DataType[],
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
} */

type FitArgs = tf.ModelFitArgs // tf.ModelFitDatasetArgs<tf.Tensor<tf.Rank>[]>

const defaultOptions: FitArgs = {
  batchSize: 1,
  epochs: 1,
  validationSplit: 0,
  shuffle: true,
}

let trainingPromise: Promise<tf.History | void> | null = null

async function train(
  model: tf.LayersModel,
  ds: Dataset,
  options: FitArgs = { epochs: 1, batchSize: 1 }
) {
  if (trainingPromise) {
    console.log("Changing ongoing training ...")
    await trainingPromise
    trainingPromise = null
  }

  options = { ...defaultOptions, ...options }

  const X = ds.data.trainX
  const y = ds.data.trainY

  try {
    trainingPromise = model.fit(X, y, options)
    const history = await trainingPromise
    return history
  } finally {
    // X.dispose()
    // y.dispose()
  }
}

async function getModelEvaluation(model: tf.LayersModel, ds: Dataset) {
  if (!ds.data.testX || !ds.data.testY)
    return { loss: undefined, accuracy: undefined }
  const X = ds.data.testX
  const y = ds.data.testY
  await tf.ready()
  const result = model.evaluate(X, y, { batchSize: 64 })
  const [lossT, accuracyT] = Array.isArray(result) ? result : [result]
  try {
    const loss = await lossT.array()
    const accuracy = await accuracyT?.array()
    return { loss, accuracy }
  } catch (e) {
    console.warn(e)
    return { loss: undefined, accuracy: undefined }
  } finally {
    lossT.dispose()
    accuracyT?.dispose()
  }
}

export async function setBackendIfAvailable(backend: string) {
  await tf.ready()
  return getAvailableBackends().includes(backend) && tf.setBackend(backend)
}

function getAvailableBackends() {
  // sort backends by priority: [webgpu, webgl, cpu]
  return Object.entries(tf.engine().registryFactory)
    .sort(([, a], [, b]) => b.priority - a.priority)
    .map(([name]) => name)
}
