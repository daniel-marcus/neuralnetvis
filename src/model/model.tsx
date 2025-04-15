import { useEffect, useCallback, useTransition, useState, useRef } from "react"
import * as tf from "@tensorflow/tfjs"
import {
  useGlobalStore,
  isDebug,
  setStatus,
  useSceneStore,
  clearStatus,
} from "@/store"
import { ExtLink } from "@/components/ui-elements/buttons"
import { useHasLesson } from "@/components/lesson"
import { getLayerDef, layerDefMap } from "./layers"
import type { Dataset, DatasetDef } from "@/data"
import type { LayerConfigArray, LayerConfigMap } from "@/model/layers/types"
import type { Layer } from "@tensorflow/tfjs-layers/dist/exports_layers"

export function useModel(ds?: Dataset) {
  const model = useModelCreate(ds)
  useModelDispose(model)
  useModelCompile(model, ds)
  return model
}

const previewLayerConfigs: LayerConfigArray = [
  { className: "Dense", config: { units: 10, activation: "relu" } },
]

function useModelCreate(ds?: Dataset) {
  const isPreview = useSceneStore((s) => !s.isActive)
  const model = useSceneStore((s) => s.model)
  const _setModel = useSceneStore((s) => s._setModel)
  const [setModel] = useModelTransition(_setModel)
  const backendReady = useGlobalStore((s) => s.backendReady)
  const layerConfigs = useSceneStore((s) => s.layerConfigs)
  const configs = isPreview ? previewLayerConfigs : layerConfigs
  useEffect(() => {
    if (!ds || !backendReady) return
    const scene = useGlobalStore.getState().scene
    if (scene.getState().skipModelCreate) {
      scene.setState({ skipModelCreate: false })
      return
    }
    const _model = createModel(ds, configs)
    if (isDebug()) console.log({ _model })
    setModel(_model, isPreview)
  }, [backendReady, configs, ds, setModel, isPreview])
  return model
}

type ModelSetter = (model?: tf.LayersModel) => void

export function useModelTransition(
  _setModel: ModelSetter,
  onTransitionFinished?: () => void
) {
  const hasLesson = useHasLesson()
  const [isPending, startTransition] = useTransition()
  const [statusId, setStatusId] = useState<string | null>(null)
  const modelToSet = useRef<tf.LayersModel | undefined>(undefined)

  const setModel = useCallback(
    async (model?: tf.LayersModel, isPreview?: boolean) => {
      modelToSet.current = model
      const id = setStatus(isPreview ? "" : "Creating model ...", -1)
      setStatusId(id)
    },
    []
  )

  useEffect(() => {
    if (!statusId || !modelToSet.current) return
    startTransition(() => {
      _setModel(modelToSet.current)
    })
  }, [_setModel, statusId])

  useEffect(() => {
    if (!isPending || !statusId) return
    return () => {
      clearStatus(statusId)
      modelToSet.current = undefined
      setStatusId(null)
      onTransitionFinished?.()
      if (!hasLesson) showModelStatus()
    }
  }, [isPending, statusId, onTransitionFinished, hasLesson])

  return [setModel, isPending] as const
}

const MODEL_STATUS_ID = "model_status"

function useModelDispose(model?: tf.LayersModel) {
  useEffect(() => {
    // dispose model on unmount
    if (!model) return
    return () => {
      try {
        clearStatus(MODEL_STATUS_ID)
        model.dispose()
        manuallyDisposeUnusedTensors(model)
      } catch (e) {
        console.warn(e)
      }
    }
  }, [model])
}

function manuallyDisposeUnusedTensors(model: tf.LayersModel) {
  // kernel and bias tensors which are created during training and not disposed automatically
  const regVars = Object.values(tf.engine().state.registeredVariables)
  for (const tw of model.trainableWeights) {
    const size = [...(tw.shape as number[])].reduce((a, b) => a * b)
    const olds = regVars.filter(
      (v) =>
        v.size === size &&
        v.trainable === false &&
        !v.name.match(
          /(BatchNormalization|batch_normalization|moving_mean|moving_variance)/
        )
    )
    // console.log({ olds })
    olds.forEach((v) => tf.dispose(v))
  }
}

function showModelStatus() {
  const scene = useGlobalStore.getState().scene.getState()
  const { model, ds } = scene
  if (!model || !ds) return
  const totalSamples = ds.train?.totalSamples ?? 0
  const data = {
    Dataset: <ExtLink href={ds.aboutUrl}>{ds.name}</ExtLink>,
    Samples: totalSamples.toLocaleString("en-US"),
    Model: model.getClassName(),
    Params: model.countParams().toLocaleString("en-US"),
  }
  setStatus({ data }, null, { id: MODEL_STATUS_ID })
}

function useModelCompile(model?: tf.LayersModel, ds?: Dataset) {
  const learningRate = useSceneStore((s) => s.trainConfig.learningRate)
  useEffect(() => {
    if (!model || !ds) return
    if (
      !isModelCompiled(model) ||
      model.optimizer.getConfig().learningRate !== learningRate
    ) {
      const isClassification = ds.task === "classification"
      model.compile({
        optimizer: tf.train.adam(learningRate),
        loss: isClassification ? "categoricalCrossentropy" : "meanSquaredError",
        metrics: isClassification ? ["accuracy"] : [],
      })
    }
  }, [model, ds, learningRate])
}

function createModel(ds: DatasetDef, layerConfigs: LayerConfigArray) {
  const dsInputShape = [null, ...ds.inputDims] as [null, ...number[]]

  const model = tf.sequential()

  const hasInputLayer = layerConfigs[0]?.className === "InputLayer"
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
      config.batchInputShape = dsInputShape
      model.add(tf.layers.inputLayer(config as LayerConfigMap["InputLayer"]))
    } else if (l.className === "Dense") {
      const newConfig = isOutput
        ? {
            ...config,
            units: ds.outputLabels.length,
            activation: ds.task === "classification" ? "softmax" : "linear",
            name: `nnv_Output`,
          }
        : config
      addDenseWithFlattenIfNeeded(model, newConfig as LayerConfigMap["Dense"])
    } else if (l.className in layerDefMap) {
      const args = config as LayerConfigMap[typeof l.className]
      const makeLayer = getLayerDef(l.className)?.constructorFunc as (
        args: unknown
      ) => Layer
      if (makeLayer) model.add(makeLayer(args))
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
