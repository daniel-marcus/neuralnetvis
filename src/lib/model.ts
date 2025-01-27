import { useControls } from "leva"
import { Dataset } from "./datasets"
import { useStatusText } from "@/components/status-text"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import * as tf from "@tensorflow/tfjs"
import "@tensorflow/tfjs-backend-webgpu"
import { DenseLayerArgs } from "@tensorflow/tfjs-layers/dist/layers/core"
import { debug } from "@/lib/debug"

const defaultUnitConfig = {
  value: 32,
  min: 16,
  max: 256,
  step: 16,
  optional: true,
}

const MAX_CONV_SIZE = 32

const defaultModelConfig = {
  conv1: {
    value: 4,
    min: 1,
    max: MAX_CONV_SIZE,
    step: 1,
    optional: true,
    disabled: true,
  },
  conv2: {
    value: 4,
    min: 1,
    max: MAX_CONV_SIZE,
    step: 1,
    optional: true,
    disabled: true,
  },
  dense1: { ...defaultUnitConfig, value: 64 },
  dense2: { ...defaultUnitConfig, value: 32, disabled: true },
}

export function useModel(ds?: Dataset) {
  const backendReady = useWebGpu()
  const [isEditing, setIsEditing] = useState(false)
  const [isPending, startTransition] = useTransition()

  const modelConfigRef = useRef<Record<string, number>>({})
  const _modelConfig = useControls(
    "model",
    Object.fromEntries(
      Object.entries(defaultModelConfig).map(([key, config]) => [
        key,
        {
          ...config,
          onEditStart: () => setIsEditing(true),
          onEditEnd: () => startTransition(() => setIsEditing(false)),
        },
      ])
    )
  ) as Record<string, number>

  const modelConfig = useMemo(() => {
    // update conv layer only after editing for smoother UI
    if (isEditing) return modelConfigRef.current
    modelConfigRef.current = _modelConfig
    return _modelConfig
  }, [_modelConfig, isEditing])

  const setStatusText = useStatusText((s) => s.setStatusText)

  /* const [model, setModel] = useState<tf.LayersModel | undefined>(undefined)
  useEffect(() => {
    setModel(undefined)
  }, [ds])*/
  const model = useMemo(() => {
    // useEffect(() => {
    if (!ds || !backendReady) return
    const startTime = Date.now()
    const [, ...dims] = ds.data.trainX.shape
    const inputShape = [null, ...dims]

    const hiddenLayerConfig = Object.keys(modelConfig)
      .map((key) => ({
        name: key,
        size: modelConfig[key],
      }))
      .filter((l) => l.size)

    const _model = createModel(inputShape, hiddenLayerConfig, ds.output)
    if (debug()) console.log({ _model })
    if (!_model) return
    const endTime = Date.now()
    if (debug()) console.log(`create model took ${endTime - startTime}ms`)
    return _model
    /* async function setup() {
      setStatusText("Generating new model ...")
      await tf.setBackend("webgl").then((success) => {
        if (debug()) console.info(`WebGL backend set with success: ${success}`)
      })
      setModel(_model)
    } 
    startTransition(() => setup())
    return () => {
      // _model.dispose()
      // setModel(undefined)
      // tf.disposeVariables()
    } */
  }, [backendReady, modelConfig, ds])

  useEffect(() => {
    if (isPending || !model || !ds) return
    const [totalSamples] = ds.data.trainX.shape
    const layersStr = model.layers
      .map((l) => {
        const name = l.getClassName()
        const shape = l.outputShape.slice(1).join("x")
        return `${name}&nbsp;(${shape})`
      })
      .join(" | ")
    const totalParamas = model.countParams()
    const text = `New Model: Model (${totalParamas.toLocaleString(
      "en-US"
    )} params)<br/>
${layersStr}<br/>
Dataset: ${ds.name} (${totalSamples.toLocaleString("en-US")} samples)<br/>`
    setStatusText(text)

    if (!isModelCompiled(model)) {
      if (debug()) console.log("Model not compiled. Compiling ...")
      model.compile({
        optimizer: tf.train.adam(),
        loss: ds.loss,
        metrics: ["accuracy"],
      })
    }
  }, [model, ds, setStatusText, isPending])
  return [model, isPending || !backendReady] as const
}

function createModel(
  inputShape: (number | null)[],
  layerConfig: { name: string; size: number }[],
  output: Dataset["output"]
) {
  const model = tf.sequential()
  model.add(tf.layers.inputLayer({ batchInputShape: inputShape }))
  for (const c of layerConfig) {
    if (c.name.startsWith("dense")) {
      // dense layer
      addDenseWithFlattenIfNeeded(model, {
        units: c.size,
        activation: "relu",
      })
    } else if (c.name.startsWith("conv")) {
      // conv2d layer + maxpooling
      model.add(
        tf.layers.conv2d({
          filters: c.size,
          kernelSize: [3, 3],
          activation: "relu",
        })
      )
      model.add(tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }))
    }
  }
  if (!layerConfig.length) {
    // no hidden layers
    model.add(tf.layers.flatten())
  }
  // output layer
  addDenseWithFlattenIfNeeded(model, {
    units: output.size,
    activation: output.activation,
  })
  return model
}

function addDenseWithFlattenIfNeeded(
  model: tf.Sequential,
  denseArgs: DenseLayerArgs
) {
  const prevLayer = model.layers[model.layers.length - 1]
  const isMutliDim = prevLayer.outputShape.length > 2
  if (isMutliDim) {
    model.add(tf.layers.flatten())
  }
  model.add(tf.layers.dense(denseArgs))
}

function isModelCompiled(model: tf.LayersModel) {
  return model.loss !== undefined && model.optimizer !== undefined
}

function useWebGpu() {
  const [isReady, setIsReady] = useState(false)
  useEffect(() => {
    tf.setBackend("webgpu").then(() => {
      setIsReady(true)
    })
  }, [])
  return isReady
}
