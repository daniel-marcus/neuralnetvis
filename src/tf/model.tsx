import { Dataset } from "@/data/datasets"
import { useStatusText } from "@/components/status"
import { useCallback, useEffect, useTransition } from "react"
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

export type LayerConfigMap = {
  Dense: DenseLayerArgs
  Conv2D: ConvLayerArgs
  MaxPooling2D: Pooling2DLayerArgs
  Flatten: FlattenLayerArgs
  Dropout: DropoutLayerArgs
}

export type HiddenLayerConfig<T extends keyof LayerConfigMap> = {
  className: T
  config: LayerConfigMap[T]
  isInvisible?: boolean
}

export type HiddenLayerConfigArray = HiddenLayerConfig<keyof LayerConfigMap>[]

interface ModelStore {
  model: tf.LayersModel | undefined
  skipCreation: boolean // flag to skip model creation for loaded models
  isPending: boolean
  setIsPending: (isPending: boolean) => void
  _setModel: (model: tf.LayersModel | undefined) => void // use modelTransition instead
  hiddenLayers: HiddenLayerConfigArray
  setHiddenLayers: (hiddenLayers: HiddenLayerConfigArray) => void
}

const defaultLayer: HiddenLayerConfig<"Dense"> = {
  className: "Dense",
  config: { units: 64, activation: "relu" },
  isInvisible: false,
}

export const useModelStore = create<ModelStore>((set) => ({
  model: undefined,
  skipCreation: false,
  isPending: false,
  setIsPending: (isPending) => set({ isPending }),
  _setModel: (model) => set({ model }),
  hiddenLayers: [defaultLayer],
  setHiddenLayers: (hiddenLayers) => set({ hiddenLayers }),
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
  const hiddenLayers = useModelStore((s) => s.hiddenLayers)
  useEffect(() => {
    if (!ds || !backendReady) return
    if (useModelStore.getState().skipCreation) {
      console.log("skip model creation")
      useModelStore.setState({ skipCreation: false })
      return
    }

    const _model = createModel(ds, hiddenLayers)

    if (debug()) console.log({ _model })
    if (!_model) return

    setModel(_model)
  }, [backendReady, hiddenLayers, ds, setModel])
  return isPending || !backendReady
}

function useModelStatus(model?: tf.LayersModel, ds?: Dataset) {
  const setStatusText = useStatusText((s) => s.setStatusText)
  useEffect(() => {
    if (!model || !ds) return
    const totalSamples = ds.train.shapeX[0]
    const layersStr = model.layers
      .map((l) => {
        const name = l.getClassName().replace("InputLayer", "Input")
        const shape = l.outputShape.slice(1).join("x")
        return `${name}\u00A0(${shape})`
      })
      .join(" | ")
    const totalParamas = model.countParams()
    const modelName = model.getClassName()
    const datasetInfo = (
      <>
        Dataset:{" "}
        <a
          href={ds.aboutUrl}
          rel="noopener noreferrer"
          className="text-accent"
          target="_blank"
        >
          {ds.name}
        </a>{" "}
        ({totalSamples.toLocaleString("en-US")} samples)
      </>
    )
    const data = {
      " ": datasetInfo,
      "  ": `Model: ${modelName} (${totalParamas.toLocaleString(
        "en-US"
      )} params)`,
      "   ": layersStr,
    }
    setStatusText({ data })
  }, [model, ds, setStatusText])
}

function useModelCompile(model?: tf.LayersModel, ds?: Dataset) {
  useEffect(() => {
    // useModelCompile
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

function createModel(ds: Dataset, hiddenLayers: HiddenLayerConfigArray) {
  const [, ...dims] = ds.train.shapeX
  const inputShape = [null, ...dims] as [null, ...number[]]

  const model = tf.sequential()

  model.add(tf.layers.inputLayer({ batchInputShape: inputShape }))

  for (const [i, l] of hiddenLayers.entries()) {
    const config = { ...l.config, name: `nnv_${l.className}_${i}` }
    if (l.className === "Dense") {
      addDenseWithFlattenIfNeeded(model, config as DenseLayerArgs)
    } else if (l.className === "Conv2D") {
      model.add(tf.layers.conv2d(config as ConvLayerArgs))
    } else if (l.className === "Flatten") {
      model.add(tf.layers.flatten(config as FlattenLayerArgs))
    } else if (l.className === "MaxPooling2D") {
      model.add(tf.layers.maxPooling2d(config as Pooling2DLayerArgs))
    } else if (l.className === "Dropout") {
      model.add(tf.layers.dropout(config as DropoutLayerArgs))
    } else {
      console.log("Unknown layer", l)
    }
  }
  // output layer
  addDenseWithFlattenIfNeeded(model, {
    units: ds.output.size,
    activation: ds.output.activation,
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
