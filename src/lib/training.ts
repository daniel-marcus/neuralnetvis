import { useState, useCallback, useEffect } from "react"
import * as tf from "@tensorflow/tfjs"
import { button, useControls } from "leva"
import { Dataset } from "./datasets"
import { useStatusText } from "@/components/status-text"
import { TrainingLog, logsPlot, useLogStore } from "@/components/logs-plot"
import { useLevaStores } from "@/components/menu"

let epochCount = 0
let sessionEpochCount = 0

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

  const { trainStore } = useLevaStores()
  const trainingConfig = useControls(
    {
      batchSize: { value: 256, min: 1, max: 512, step: 1 },
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

  useControls(
    () => ({
      logs: logsPlot(),
    }),
    { store: trainStore }
  )

  const setLogs = useLogStore((s) => s.setLogs)

  useEffect(() => {
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
    if (isNewSession) sessionEpochCount = 0
    const initialEpoch = epochCount > 0 ? epochCount : 0
    const epochs = initialEpoch + _epochs - sessionEpochCount
    async function startTraining() {
      if (!model || !ds) return
      // use wegpu for silent training (faster)
      if (silent) await setBackendIfAvailable("webgpu")
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
          if (!silent) {
            next(step) // trigger view update
            setBatchCounter((prev) => prev + 1) // trigger model update
          }
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
          if (silent) {
            const processedSamples = trainSampleSize - 1
            next(processedSamples) // update view
            setBatchCounter((c) => c + processedSamples) // update weights
          }
          const { accuracy, loss } = await getModelEvaluation(model, ds)
          if (!trainingPromise || trainingComplete)
            setStatusText(
              `Training finished (${tf.getBackend()})<br/>Loss: ${loss?.toFixed(
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

  const { X, y } = tf.tidy(() => {
    const { data, shape } = ds.data.trainX
    const X = tf.tensor(data, shape).div(255) // TODO: normalize somewhere else?
    const y = getY(ds.data.trainY, ds.output)
    return { X, y }
  })

  try {
    trainingPromise = model.fit(X, y, options)
    const history = await trainingPromise
    return history
  } finally {
    X.dispose()
    y.dispose()
  }
}

function getY(trainY: number[], output: Dataset["output"]) {
  return output.activation === "softmax"
    ? tf.oneHot(trainY, output.size)
    : tf.tensor(trainY)
}

async function getModelEvaluation(model: tf.LayersModel, ds: Dataset) {
  const { loss, accuracy } = tf.tidy(() => {
    if (!ds.data.testX || !ds.data.testY)
      return { loss: undefined, accuracy: undefined }
    const { data, shape } = ds.data.testX
    const X = tf.tensor(data, shape).div(255)
    const y = getY(ds.data.testY, ds.output)
    const result = model.evaluate(X, y, { batchSize: 64 })
    const loss = (Array.isArray(result) ? result[0] : result).dataSync()[0]
    const accuracy = Array.isArray(result) ? result[1].dataSync()[0] : undefined
    return { loss, accuracy }
  })

  return { loss, accuracy }
}

export async function setBackendIfAvailable(backend: string) {
  return getAvailableBackends().includes(backend) && tf.setBackend(backend)
}

function getAvailableBackends() {
  // sort backends by priority: [webgpu, webgl, cpu]
  return Object.entries(tf.engine().registryFactory)
    .sort(([, a], [, b]) => b.priority - a.priority)
    .map(([name]) => name)
}
