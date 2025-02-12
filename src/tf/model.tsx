import { Dataset } from "@/data/datasets"
import { useStatusText } from "@/components/status"
import { ReactNode, useCallback, useEffect, useTransition } from "react"
import * as tf from "@tensorflow/tfjs"
import {
  DenseLayerArgs,
  DropoutLayerArgs,
  FlattenLayerArgs,
} from "@tensorflow/tfjs-layers/dist/layers/core"
import { debug } from "@/lib/debug"
import { create } from "zustand"
import { useTfBackend } from "../tf/tf-backend"
import { ConvLayerArgs } from "@tensorflow/tfjs-layers/dist/layers/convolutional"
import { Pooling2DLayerArgs } from "@tensorflow/tfjs-layers/dist/layers/pooling"
import { InputLayerArgs } from "@tensorflow/tfjs-layers/dist/engine/input_layer"

export type LayerConfigMap = {
  Dense: DenseLayerArgs
  Conv2D: ConvLayerArgs
  MaxPooling2D: Pooling2DLayerArgs
  Flatten: FlattenLayerArgs
  Dropout: DropoutLayerArgs
  InputLayer: InputLayerArgs
}

export type LayerConfig<T extends keyof LayerConfigMap> = {
  className: T
  config: LayerConfigMap[T]
  isInvisible?: boolean
}

export type LayerConfigArray = LayerConfig<keyof LayerConfigMap>[]

const defaultLayerConfigs: LayerConfig<"Dense">[] = [
  {
    className: "Dense",
    config: { units: 64, activation: "relu" },
  },
  { className: "Dense", config: { units: 10, activation: "softmax" } },
]

interface ModelStore {
  model: tf.LayersModel | undefined
  skipCreation: boolean // flag to skip model creation for loaded models
  isPending: boolean
  setIsPending: (isPending: boolean) => void
  _setModel: (model: tf.LayersModel | undefined) => void // use modelTransition instead
  layerConfigs: LayerConfigArray
  setLayerConfigs: (layerConfigs: LayerConfigArray) => void
  resetLayerConfigs: () => void
}

export const useModelStore = create<ModelStore>((set) => ({
  model: undefined,
  skipCreation: false,
  isPending: false,
  setIsPending: (isPending) => set({ isPending }),
  _setModel: (model) => set({ model }),
  layerConfigs: defaultLayerConfigs,
  setLayerConfigs: (layerConfigs) => set({ layerConfigs }),
  resetLayerConfigs: () => set({ layerConfigs: defaultLayerConfigs }),
}))

export function useModel(ds?: Dataset) {
  const model = useModelStore((s) => s.model)
  const isPending = useModelCreation(ds)
  useModelReset(model, ds)
  useModelStatus(model, ds)
  useModelCompile(model, ds)
  return [model, isPending] as const
}

export function useModelTransition() {
  const [_isPending, startTransition] = useTransition()
  const _setModel = useModelStore((s) => s._setModel)
  const isPending = useModelStore((s) => s.isPending)
  const setIsPending = useModelStore((s) => s.setIsPending)
  const setModel = useCallback(
    (model: tf.LayersModel | undefined) => {
      startTransition(() => _setModel(model))
    },
    [startTransition, _setModel]
  )
  useEffect(() => {
    setIsPending(_isPending)
  }, [_isPending, setIsPending])

  // set progressbar to spinner mode
  const setPercent = useStatusText((s) => s.setPercent)
  useEffect(() => {
    if (!_isPending) return
    setPercent(-1)
    return () => {
      setPercent(null)
    }
  }, [_isPending, setPercent])

  return [setModel, isPending] as const
}

function useModelReset(model?: tf.LayersModel, ds?: Dataset) {
  useEffect(() => {
    // unset on ds change
    return () => {
      useModelStore.getState()._setModel(undefined)
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
  const layerConfigs = useModelStore((s) => s.layerConfigs)
  useEffect(() => {
    if (!ds || !backendReady) return
    if (useModelStore.getState().skipCreation) {
      console.log("skip model creation")
      useModelStore.setState({ skipCreation: false })
      return
    }

    const _model = createModel(ds, layerConfigs)

    if (debug()) console.log({ _model })
    if (!_model) return

    setModel(_model)
  }, [backendReady, layerConfigs, ds, setModel])
  return isPending || !backendReady
}

function useModelStatus(model?: tf.LayersModel, ds?: Dataset) {
  const setStatusText = useStatusText((s) => s.setStatusText)
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
      if (debug()) console.log("Model not compiled. Compiling ...", model)
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
    const isOutput = i === layerConfigs.length - 1 && layerConfigs.length > 1
    const config = { ...l.config, name: `nnv_${l.className}_${i}` }
    if (l.className === "Dense") {
      const configNew = isOutput // use config from ds for output layer
        ? { ...config, units: ds.output.size, activation: ds.output.activation }
        : config
      addDenseWithFlattenIfNeeded(model, configNew as DenseLayerArgs)
    } else if (l.className === "Conv2D") {
      model.add(tf.layers.conv2d(config as ConvLayerArgs))
    } else if (l.className === "Flatten") {
      model.add(tf.layers.flatten(config as FlattenLayerArgs))
    } else if (l.className === "MaxPooling2D") {
      model.add(tf.layers.maxPooling2d(config as Pooling2DLayerArgs))
    } else if (l.className === "Dropout") {
      model.add(tf.layers.dropout(config as DropoutLayerArgs))
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
