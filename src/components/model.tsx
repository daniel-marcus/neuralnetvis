import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Sequential } from "./sequential"
import * as tf from "@tensorflow/tfjs"
import trainData from "./train_data.json"
import trainLabels from "./train_labels.json"

export const Model = () => {
  const [input, label, next] = useInputData()
  const [model, setModel] = useState<tf.LayersModel | null>(null)
  useEffect(() => {
    async function loadModel() {
      const _model = await tf.loadLayersModel("/model/model.json")
      console.log("MODEL LOADED", _model)
      setModel(_model)
    }
    loadModel()
  }, [])
  useKeypressTrainer(input, model, setModel, next, label)
  if (!model) return null
  return <Sequential model={model} input={input} />
}

function useInputData() {
  const initialRandomIndex = Math.floor(Math.random() * ds.length)
  const [i, setI] = useState(initialRandomIndex)
  const data = useMemo(() => ds[i], [i])
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
  return [data, label, next] as const
}

export const normalize = (data: number[]) => {
  const max = Math.max(...data)
  return data.map((d) => d / max)
}

const ds = trainData.map(normalize)

function useKeypressTrainer(
  input: number[],
  model: tf.LayersModel | null,
  setModel: React.Dispatch<React.SetStateAction<tf.LayersModel | null>>,
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
        setModel(model)
        next()
      }
      if (e.key === "t") setIsAutoTraining((t) => !t)
    }
    window.addEventListener("keydown", onKeydown)
    return () => {
      window.removeEventListener("keydown", onKeydown)
    }
  }, [input, model, setModel, next])
  useEffect(() => {
    if (!isAutoTraining || !model || typeof label === "undefined") return
    async function autoTrain() {
      if (!model || typeof label === "undefined") return
      await train(model, input, label)
      setModel(model)
      next()
    }
    autoTrain()
  }, [model, isAutoTraining, input, next, label, setModel])
}

async function train(model: tf.LayersModel, input: number[], label: number) {
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
  await model.fit(X, y, {
    epochs: 1,
    batchSize: 1,
  })
  // console.log("Training completed!")
}

function isModelCompiled(model: tf.LayersModel) {
  return model.loss !== undefined && model.optimizer !== undefined
}
