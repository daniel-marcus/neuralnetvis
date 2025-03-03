import { useEffect, ReactNode, useCallback, useTransition } from "react"
import * as tf from "@tensorflow/tfjs"
import { useTfBackend } from "./tf-backend"
import { useStore, isDebug, setStatus } from "@/store"
import type { Dataset } from "@/data"
import type { LayerConfigArray, LayerConfigMap } from "./types"
import { checkShapeMatch } from "@/data/utils"
import { useHasLesson } from "@/components/lesson"

export function useModel(ds?: Dataset) {
  const model = useStore((s) => s.model)
  const isPending = useModelCreate(ds)
  useModelDispose(model)
  useModelStatus(isPending, model)
  useModelCompile(model, ds)
  return model
}

function useModelCreate(ds?: Dataset) {
  const backendReady = useTfBackend()
  const [setModel, isPending] = useModelTransition()
  const layerConfigs = useStore((s) => s.layerConfigs)
  useEffect(() => {
    if (!ds || !backendReady) return
    if (useStore.getState().skipModelCreate) {
      useStore.setState({ skipModelCreate: false })
      return
    }

    const _model = createModel(ds, layerConfigs)

    if (isDebug()) console.log({ _model })
    if (!_model) return

    setModel(_model)
  }, [backendReady, layerConfigs, ds, setModel])
  return isPending
}

export function useModelTransition() {
  const [isPending, startTransition] = useTransition()
  const _setModel = useStore((s) => s._setModel)
  const setModel = useCallback(
    async (model?: tf.LayersModel) => {
      startTransition(() => {
        _setModel(model)
      })
    },
    [_setModel]
  )
  return [setModel, isPending] as const
}

function useModelDispose(model?: tf.LayersModel) {
  useEffect(() => {
    // dispose model on unmount
    if (!model) return
    return () => {
      manuallyDisposeUnusedTensors(model)
      model.dispose()
    }
  }, [model])
}

function manuallyDisposeUnusedTensors(model: tf.LayersModel) {
  // kernel and bias tensors which are created during training and not disposed automatically
  const regVars = Object.values(tf.engine().state.registeredVariables)
  for (const tw of model.trainableWeights) {
    const size = [...(tw.shape as number[])].reduce((a, b) => a * b)
    const olds = regVars.filter((v) => v.size === size && v.trainable === false)
    olds.forEach((v) => tf.dispose(v))
  }
}

function useModelStatus(isPending: boolean, model?: tf.LayersModel) {
  const hasLesson = useHasLesson()
  useEffect(() => {
    if (!model || !isPending || hasLesson) return
    const ds = useStore.getState().ds
    if (!ds) return
    const totalSamples = useStore.getState().totalSamples()
    const data = {
      Dataset: <ExtLink href={ds.aboutUrl}>{ds.name}</ExtLink>,
      Samples: totalSamples.toLocaleString("en-US"),
      Model: model.getClassName(),
      Params: model.countParams().toLocaleString("en-US"),
    }
    setStatus({ data }, null)
  }, [model, isPending, hasLesson])
}

const ExtLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} rel="noopener" className="text-accent" target="_blank">
    {children}
  </a>
)

function useModelCompile(model?: tf.LayersModel, ds?: Dataset) {
  useEffect(() => {
    if (!model || !ds) return
    if (!isModelCompiled(model)) {
      if (isDebug()) console.log("Model not compiled. Compiling ...", model)
      const isClassification = ds.task === "classification"
      model.compile({
        optimizer: tf.train.adam(),
        loss: isClassification ? "categoricalCrossentropy" : "meanSquaredError",
        metrics: isClassification ? ["accuracy"] : [],
      })
    }
  }, [model, ds])
}

function createModel(ds: Dataset, layerConfigs: LayerConfigArray) {
  const isMultiDim = ds.inputDims.length >= 2
  const dsInputShape = [null, ...ds.inputDims] as [null, ...number[]]

  const model = tf.sequential()

  const hasInputLayer = layerConfigs[0].className === "InputLayer"
  if (!hasInputLayer) {
    model.add(
      tf.layers.inputLayer({
        batchInputShape: dsInputShape,
        name: `nnv_InputLayer`,
      })
    )
  }

  for (const [i, l] of layerConfigs.entries()) {
    const isOutput = i === layerConfigs.length - 1
    const config = { ...l.config, name: `nnv_${l.className}_${i}` }
    if (l.className === "InputLayer") {
      config.batchInputShape =
        !!config.batchInputShape &&
        checkShapeMatch(config.batchInputShape, dsInputShape)
          ? config.batchInputShape
          : dsInputShape
      model.add(tf.layers.inputLayer(config as LayerConfigMap["InputLayer"]))
    } else if (l.className === "Dense") {
      const configNew = isOutput // use config from ds for output layer
        ? {
            ...config,
            units: ds.outputLabels.length,
            activation: ds.task === "classification" ? "softmax" : "linear",
            name: `nnv_Output`,
          }
        : config
      addDenseWithFlattenIfNeeded(model, configNew as LayerConfigMap["Dense"])
    } else if (l.className === "Conv2D") {
      if (!isMultiDim) continue
      model.add(tf.layers.conv2d(config as LayerConfigMap["Conv2D"]))
    } else if (l.className === "Flatten") {
      if (!isMultiDim) continue
      model.add(tf.layers.flatten(config as LayerConfigMap["Flatten"]))
    } else if (l.className === "MaxPooling2D") {
      if (!isMultiDim) continue
      model.add(
        tf.layers.maxPooling2d(config as LayerConfigMap["MaxPooling2D"])
      )
    } else if (l.className === "Dropout") {
      model.add(tf.layers.dropout(config as LayerConfigMap["Dropout"]))
    } else if (l.className === "InputLayer") {
      continue // InputLayer is already added w/ config from ds
    } else {
      console.log("Unknown layer", l)
    }
  }

  return model
}

function addDenseWithFlattenIfNeeded(
  model: tf.Sequential,
  denseArgs: LayerConfigMap["Dense"]
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
