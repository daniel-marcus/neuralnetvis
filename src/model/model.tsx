import { useCallback, useEffect, useTransition, ReactNode } from "react"
import * as tf from "@tensorflow/tfjs"
import { useTfBackend } from "./tf-backend"
import { useStore, isDebug } from "@/store"
import type { Dataset } from "@/data"
import type { LayerConfigArray, LayerConfigMap } from "./types"

export function useModel(ds?: Dataset) {
  const model = useStore((s) => s.model)
  useModelCreation(ds)
  useModelReset(model, ds)
  useModelStatus(model, ds)
  useModelCompile(model, ds)
  return model
}

export function useModelTransition() {
  const [isPending, startTransition] = useTransition()
  const _setModel = useStore((s) => s._setModel)
  const setModel = useCallback(
    (model: tf.LayersModel | undefined) => {
      startTransition(() => _setModel(model))
    },
    [startTransition, _setModel]
  )

  // set progressbar to spinner mode
  const setPercent = useStore((s) => s.status.setPercent)
  useEffect(() => {
    if (!isPending) return
    setPercent(-1)
    return () => {
      setPercent(null)
    }
  }, [isPending, setPercent])

  return [setModel, isPending] as const
}

function useModelReset(model?: tf.LayersModel, ds?: Dataset) {
  useEffect(() => {
    // unset on ds change
    return () => {
      useStore.getState()._setModel(undefined) // TODO: write setter
    }
  }, [ds])
  useEffect(() => {
    // dispose model on unmount
    if (!model) return
    return () => {
      model.dispose()
    }
  }, [model])
}

function useModelCreation(ds?: Dataset) {
  const backendReady = useTfBackend()
  const [setModel, isPending] = useModelTransition()
  const layerConfigs = useStore((s) => s.layerConfigs)
  useEffect(() => {
    if (!ds || !backendReady) return
    if (useStore.getState().skipModelCreation) {
      console.log("skip model creation")
      useStore.setState({ skipModelCreation: false })
      return
    }

    const _model = createModel(ds, layerConfigs)

    if (isDebug()) console.log({ _model })
    if (!_model) return

    setModel(_model)
  }, [backendReady, layerConfigs, ds, setModel])
  return isPending || !backendReady
}

function useModelStatus(model?: tf.LayersModel, ds?: Dataset) {
  const setStatusText = useStore((s) => s.status.setText)
  useEffect(() => {
    if (!model || !ds) return
    const data = {
      Dataset: <ExtLink href={ds.aboutUrl}>{ds.name}</ExtLink>,
      Samples: ds.train.shapeX[0].toLocaleString("en-US"),
      Model: model.getClassName(),
      Params: model.countParams().toLocaleString("en-US"),
    }
    setStatusText({ data })
  }, [model, ds, setStatusText])
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
      model.compile({
        optimizer: tf.train.adam(),
        loss: ds.loss,
        metrics: ["accuracy"],
      })
    }
  }, [model, ds])
}

function createModel(ds: Dataset, layerConfigs: LayerConfigArray) {
  const [, ...dims] = ds.train.shapeX
  const inputShape = [null, ...dims] as [null, ...number[]]

  const model = tf.sequential()

  model.add(tf.layers.inputLayer({ batchInputShape: inputShape }))

  for (const [i, l] of layerConfigs.entries()) {
    const isOutput = i === layerConfigs.length - 1
    const config = { ...l.config, name: `nnv_${l.className}_${i}` }
    if (l.className === "Dense") {
      const configNew = isOutput // use config from ds for output layer
        ? { ...config, units: ds.output.size, activation: ds.output.activation }
        : config
      addDenseWithFlattenIfNeeded(model, configNew as LayerConfigMap["Dense"])
    } else if (l.className === "Conv2D") {
      model.add(tf.layers.conv2d(config as LayerConfigMap["Conv2D"]))
    } else if (l.className === "Flatten") {
      model.add(tf.layers.flatten(config as LayerConfigMap["Flatten"]))
    } else if (l.className === "MaxPooling2D") {
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
