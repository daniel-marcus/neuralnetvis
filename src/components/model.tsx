import React, {
  useEffect,
  useMemo,
  useState,
  createContext,
  useCallback,
  useContext,
} from "react"
import { Sequential } from "./sequential"
import * as tf from "@tensorflow/tfjs"
import trainData from "@/data/train_data.json"
import trainLabels from "@/data/train_labels.json"
import { button, useControls } from "leva"
import { StatusTextContext } from "./app"

interface Options {
  hideLines?: boolean
}

export const OptionsContext = createContext<Options>({})
export const TrainingLabelContext = createContext<number | undefined>(undefined)

export const Model = () => {
  const [input, label, next, i] = useInputData()
  const [model, hideLines] = useModel(i, next)
  useManualTraining(model, input, next)
  if (!model) return null
  return (
    <OptionsContext.Provider value={{ hideLines }}>
      <TrainingLabelContext.Provider value={label}>
        <Sequential model={model} input={input} />
      </TrainingLabelContext.Provider>
    </OptionsContext.Provider>
  )
}

interface SliderInput {
  value: number
  min: number
  max: number
  step: number
  optional?: boolean
  disabled?: boolean
}

const defaultUnitConfig: SliderInput = {
  value: 32,
  min: 16,
  max: 256,
  step: 16,
  optional: true,
}

let shouldInterrupt = false // used to avoid the last next() call on training stop
let epochCount = 0

function useModel(i: number, next: (step?: number) => void) {
  const [isTraining, setIsTraining] = useState(false)
  const toggleTraining = useCallback(
    () =>
      setIsTraining((t) => {
        if (t) {
          shouldInterrupt = true
          return false
        } else {
          shouldInterrupt = false
          return true
        }
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

  const config = useControls("layers and units", {
    layer1: defaultUnitConfig,
    layer2: { ...defaultUnitConfig, disabled: true },
    layer3: { ...defaultUnitConfig, disabled: true },
  }) as Record<string, number>

  const hideLinesDuringTraining = true // could be control

  const { batchSize } = useControls({
    batchSize: { value: 1, min: 1, max: 32, step: 1 },
  })

  useControls(
    {
      [`${isTraining ? "Stop" : "Start"} training`]: button(() =>
        toggleTraining()
      ),
    },
    [isTraining]
  )

  const setStatusText = useContext(StatusTextContext)

  const model = useMemo(() => {
    setIsTraining(false)
    epochCount = 0
    const layerUnits = Object.keys(config)
      .map((key) => config[key] as number)
      .filter((l) => l)
    const _model = createModel(layerUnits)
    const totalParamas = _model.countParams()
    const text = `Sequential Model created<br/>
Input (784) | ${layerUnits
      .map((u) => `Dense (${u})`)
      .join(" | ")} | Output (10)<br/>
Params: ${totalParamas.toLocaleString("en-US")}`
    setStatusText(text)
    return _model
  }, [config, setStatusText])

  useEffect(() => {
    if (!isTraining || !model) return
    const inputs = getBatch(ds, batchSize, i)
    const labels = getBatch(trainLabels, batchSize, i).map((l) => l[0])
    async function autoTrain() {
      if (!model) return
      console.log(i)
      const cb: TrainCallback = (_, loss, acc) => {
        if (!shouldInterrupt)
          setStatusText(`Training ... Epoch ${epochCount}<br/>
Loss: ${loss ?? "N/A"}<br/>
Acc: ${acc ?? "N/A"}`)
      }
      epochCount++
      await train(model, inputs, labels, batchSize, cb)
      if (!shouldInterrupt) next(batchSize)
    }
    autoTrain()
  }, [model, isTraining, i, next, setStatusText, batchSize])

  const hideLines = isTraining && hideLinesDuringTraining

  return [model, hideLines] as const
}

function getBatch<T>(arr: T[], batchSize: number, startI = 0) {
  const batch = arr.slice(startI, startI + batchSize)
  return batch
}

function createModel(hiddenLayerUnits = [128, 64]) {
  const model = tf.sequential()
  model.add(tf.layers.inputLayer({ batchInputShape: [null, 784] }))
  for (const units of hiddenLayerUnits) {
    model.add(tf.layers.dense({ units, activation: "relu" }))
  }
  model.add(tf.layers.dense({ units: 10, activation: "softmax" }))
  return model
}

function useInputData() {
  const initialRandomIndex = Math.floor(Math.random() * ds.length)
  const [i, setI] = useState(initialRandomIndex)
  const input = useMemo(() => ds[i], [i])
  const label = useMemo(() => trainLabels[i][0], [i])
  const next = useCallback(
    (step = 1) => setI((i) => (i + step < ds.length ? i + step : 0)),
    []
  )
  useEffect(() => {
    const prev = () => setI((i) => (i > 0 ? i - 1 : ds.length - 1))
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next()
      if (e.key === "ArrowLeft") prev()
    }
    const l = 0 // setInterval(next, 1000)
    window.addEventListener("keydown", onKeydown)
    return () => {
      window.removeEventListener("keydown", onKeydown)
      clearInterval(l)
    }
  }, [next])
  return [input, label, next, i] as const
}

export const normalize = (data: number[] | unknown) => {
  if (!Array.isArray(data)) return [] as number[]
  const max = Math.max(...data)
  return data.map((d) => d / max)
}

const ds = trainData.map(normalize)

function useManualTraining(
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

type TrainCallback = (epoch: number, loss?: string, acc?: string) => void

async function train(
  model: tf.LayersModel,
  inputs: number[][],
  labels: number[],
  batchSize = 1,
  cb?: TrainCallback //  | (() => void)
) {
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
      epochs: 1,
      batchSize,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          const loss = logs?.loss.toFixed(4)
          const acc = logs?.acc ? (logs?.acc * 100).toFixed(2) : undefined
          if (typeof cb === "function") cb(epoch, loss, acc)
        },
      },
    })
    .catch(console.error)
}

function isModelCompiled(model: tf.LayersModel) {
  return model.loss !== undefined && model.optimizer !== undefined
}
