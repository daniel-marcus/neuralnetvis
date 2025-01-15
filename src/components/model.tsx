import React, {
  useEffect,
  useMemo,
  useState,
  createContext,
  useCallback,
} from "react"
import { Sequential } from "./sequential"
import * as tf from "@tensorflow/tfjs"
import trainData from "./train_data.json"
import trainLabels from "./train_labels.json"

interface Options {
  hideLines?: boolean
}

export const OptionsContext = createContext<Options>({})

export const Model = () => {
  const model = useModelLoader()
  const [input, label, next] = useInputData()
  const isTraining = useKeypressTrainer(model, input, next, label)
  if (!model) return null
  return (
    <OptionsContext.Provider value={{ hideLines: isTraining }}>
      <Sequential model={model} input={input} />
    </OptionsContext.Provider>
  )
}

function useModelLoader() {
  const [model, setModel] = useState<tf.LayersModel | null>(null)
  useEffect(() => {
    /* async function loadModel() {
      const _model = await tf.loadLayersModel("/model/model.json")
      console.log("MODEL LOADED", _model)
      setModel(_model)
    }
    loadModel() */
    const newModel = createModel([64])
    setModel(newModel)
  }, [])
  return model
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
    () => setI((i) => (i < ds.length - 1 ? i + 1 : 0)),
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
  return [input, label, next] as const
}

export const normalize = (data: number[]) => {
  const max = Math.max(...data)
  return data.map((d) => d / max)
}

const ds = trainData.map(normalize)

let shouldInterrupt = false // used to avoid the last next() call on auto-training abort

function useKeypressTrainer(
  model: tf.LayersModel | null,
  input: number[],
  next: () => void,
  label?: number
) {
  const [isAutoTraining, setIsAutoTraining] = useState(false)
  useEffect(() => {
    if (!model) return
    const onKeydown = async (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        const pressedNumber = parseInt(e.key)
        await train(model, input, pressedNumber)
        next()
      }
      if (e.key === "t")
        setIsAutoTraining((t) => {
          if (t) {
            shouldInterrupt = true
            return false
          } else {
            shouldInterrupt = false
            return true
          }
        })
    }
    window.addEventListener("keydown", onKeydown)
    return () => {
      window.removeEventListener("keydown", onKeydown)
    }
  }, [input, model, next])
  useEffect(() => {
    if (!isAutoTraining || !model || typeof label === "undefined") return
    async function autoTrain() {
      if (!model || typeof label === "undefined") return
      await train(model, input, label)
      if (!shouldInterrupt) next()
    }
    autoTrain()
  }, [model, isAutoTraining, input, next, label])
  return isAutoTraining
}

let isTraining = false

async function train(
  model: tf.LayersModel,
  input: number[],
  label: number,
  cb?: () => void
) {
  if (isTraining) return
  isTraining = true
  const X = tf.tensor([input])
  const numClasses = 10
  const y = tf.oneHot([label], numClasses)
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
      batchSize: 1,
      callbacks: {
        onEpochEnd: async () => {
          isTraining = false
          if (typeof cb === "function") cb()
        },
      },
    })
    .catch(console.error)
}

function isModelCompiled(model: tf.LayersModel) {
  return model.loss !== undefined && model.optimizer !== undefined
}
