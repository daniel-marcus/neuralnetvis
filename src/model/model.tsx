import { useEffect, useCallback, useTransition, useState, useRef } from "react"
import * as tf from "@tensorflow/tfjs"
import { useGlobalStore, setStatus, useSceneStore, clearStatus, isDebug } from "@/store"
import { fetchWithProgress, type OnProgressCb } from "@/data/npy-loader"
import { ExtLink } from "@/components/ui-elements/buttons"
import { useHasLesson } from "@/components/lesson"
import { useKeyCommand } from "@/utils/key-command"
import { getLayerDef, layerDefMap } from "./layers"
import type { Layer } from "@tensorflow/tfjs-layers/dist/exports_layers"
import type { Dataset, DatasetDef } from "@/data"
import type { LayerConfigArray, LayerConfigMap } from "@/model/layers/types"
import type { ModelLoadState, ModelSlice } from "@/store/model"
import type { ModelDef } from "./models"

export function useModel(ds?: Dataset) {
  const model = useModelCreate(ds)
  useModelDispose(model)
  useModelCompile(model, ds)
  useKeyCommand("m", showModelStatus)
  return model
}

const defaultConfigs: LayerConfigArray = [
  { className: "Dense", config: { units: 64, activation: "relu" } },
  { className: "Dense", config: { units: 10, activation: "relu" } },
]

function useModelCreate(ds?: Dataset) {
  // const isPreview = false // useSceneStore((s) => !s.isActive)
  const model = useSceneStore((s) => s.model)
  const _setModel = useSceneStore((s) => s._setModel)
  const [setModel] = useModelTransition(_setModel)
  const backendReady = useGlobalStore((s) => s.backendReady)
  const shouldLoadWeights = useSceneStore((s) => s.shouldLoadWeights)
  const configs = useSceneStore((s) => s.layerConfigs)
  useEffect(() => {
    async function loadModel() {
      if (!ds || !backendReady) return
      const scene = useGlobalStore.getState().scene
      if (scene.getState().skipModelCreate) {
        scene.setState({ skipModelCreate: false })
        return
      }

      const getNewModel = () => createModel(ds, configs ?? defaultConfigs)

      if (ds.model && !configs) {
        const noWeights = ds.model.lazyLoadWeights && !shouldLoadWeights
        const pt = await getPretrained(ds.model, noWeights)
        setModel(pt.model, pt.loadState, true)
      } else {
        const _model = getNewModel()
        setModel(_model, "full", true)
      }
    }
    loadModel()
  }, [backendReady, ds, configs, setModel, shouldLoadWeights])
  return model
}

type GetPretrainedModelResult = {
  model?: tf.LayersModel
  loadState: ModelLoadState
}

async function getPretrained(
  modelDef: ModelDef,
  noWeights?: boolean,
): Promise<GetPretrainedModelResult> {
  const { path, key, version } = modelDef
  const allModels = await tf.io.listModels()
  const dbPath = `indexeddb://nnv_${key}_v${version}`
  if (dbPath in allModels) {
    // console.log("Model exists in IndexedDB:", dbPath)
    const model = await tf.loadLayersModel(dbPath)
    return { model, loadState: "full" }
  }
  try {
    if (noWeights) {
      const model = await tf.loadLayersModel(path, { streamWeights: true })
      return { model, loadState: "no-weights" }
    }
    const statusId = setStatus(`Loading model weights ...`, 0)
    const time = getTimer()
    // download first (with progress), then build the model: tfjs creates all variables with random
    // initial values before assigning the weights, see loadLayersModelFromIOHandler
    const fetchFunc = getFetchWithProgress((percent) =>
      setStatus(`Loading model weights (${Math.round(percent * 100)}%)`, percent, {
        id: statusId,
      }),
    )
    const artifacts = await tf.io.http(path, { fetchFunc }).load?.()
    if (!artifacts) throw new Error("No model artifacts")
    time("download")
    setStatus(`Initializing model ...`, -1, { id: statusId })
    const model = await tf.loadLayersModel(tf.io.fromMemory(artifacts))
    time("init")
    setStatus(`Saving model to cache ...`, -1, { id: statusId })
    await model.save(dbPath)
    time("cache")
    clearStatus(statusId)
    return { model, loadState: "full" }
  } catch (e) {
    console.warn("Failed to load pretrained model from", path, e)
    return { model: undefined, loadState: null }
  }
}

// fetch with the progress of all weight files (bytes), model.json is not counted
function getFetchWithProgress(onProgress: (percent: number) => void) {
  const loaded: Record<string, number> = {}
  const total: Record<string, number> = {}
  const cb: OnProgressCb = ({ path, loadedBytes, totalBytes }) => {
    loaded[path] = loadedBytes
    total[path] = totalBytes
    onProgress(sum(loaded) / sum(total))
  }
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString()
    const isWeights = !new URL(url, location.href).pathname.endsWith(".json")
    return isWeights ? fetchWithProgress(url, cb, init) : fetch(input, init)
  }
}

const sum = (bytes: Record<string, number>) => Object.values(bytes).reduce((a, b) => a + b, 0)

function getTimer() {
  let last = performance.now()
  return (step: string) => {
    const now = performance.now()
    if (isDebug()) console.log(`model ${step}: ${Math.round(now - last)}ms`)
    last = now
  }
}

export function useModelTransition(
  _setModel: ModelSlice["_setModel"],
  onTransitionFinished?: () => void,
) {
  const hasLesson = useHasLesson()
  const [isPending, startTransition] = useTransition()
  const [statusId, setStatusId] = useState<string | null>(null)
  const modelToSet = useRef<tf.LayersModel | undefined>(undefined)
  const loadStateToSet = useRef<ModelLoadState | undefined>(undefined)

  const setModel = useCallback(
    async (model?: tf.LayersModel, loadState?: ModelLoadState, silent?: boolean) => {
      modelToSet.current = model
      loadStateToSet.current = loadState
      const id = setStatus(silent ? "" : "Creating model ...", -1)
      setStatusId(id)
    },
    [],
  )

  useEffect(() => {
    if (!statusId || !modelToSet.current) return
    startTransition(() => {
      _setModel(modelToSet.current, loadStateToSet.current)
    })
  }, [_setModel, statusId])

  useEffect(() => {
    if (!isPending || !statusId) return
    return () => {
      clearStatus(statusId)
      modelToSet.current = undefined
      loadStateToSet.current = undefined
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
        !v.name.match(/(BatchNormalization|batch_normalization|moving_mean|moving_variance)/),
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
    Model: ds.model?.sourceUrl ? (
      <ExtLink href={ds.model.sourceUrl}>{ds.model.name ?? ds.model.key}</ExtLink>
    ) : (
      model.name
    ),
    Params: model.countParams().toLocaleString("en-US"),
  }
  setStatus({ data }, null, { id: MODEL_STATUS_ID })
}

function useModelCompile(model?: tf.LayersModel, ds?: Dataset) {
  const learningRate = useSceneStore((s) => s.trainConfig.learningRate)
  useEffect(() => {
    if (!model || !ds) return
    if (!isModelCompiled(model) || model.optimizer.getConfig().learningRate !== learningRate) {
      const isClassification = ds.task === "classification"
      const isNextToken = ds.task === "nextToken" // sparse targets, incl. <PAD> and <OOV> (no masking)
      model.compile({
        optimizer: tf.train.adam(learningRate),
        loss: isNextToken
          ? "sparseCategoricalCrossentropy"
          : isClassification
            ? "categoricalCrossentropy"
            : "meanSquaredError",
        metrics: isClassification || isNextToken ? ["accuracy"] : [],
      })
    }
  }, [model, ds, learningRate])
}

class LayerStack {
  nodes: tf.SymbolicTensor[]
  constructor(input: tf.SymbolicTensor) {
    this.nodes = [input]
  }
  add(layer: Layer, inputs: tf.SymbolicTensor[] = [this.last]) {
    const output = layer.apply(inputs) as tf.SymbolicTensor
    this.nodes.push(output)
  }
  get last() {
    return this.nodes[this.nodes.length - 1]
  }
  getNodeByLayerName(name: string) {
    return this.nodes.find((n) => n.sourceLayer.name === name)
  }
}

function createModel(ds: DatasetDef, layerConfigs: LayerConfigArray) {
  const input = tf.input({ shape: ds.inputDims, name: "nnv_Input" })
  const layerStack = new LayerStack(input)
  for (const [i, l] of layerConfigs.entries()) {
    const isOutput = i === layerConfigs.length - 1
    const config = { ...l.config, name: `nnv_${l.className}_${i}` }

    if (l.className === "InputLayer") {
      continue
    } else if (l.className === "Dense") {
      const newConfig = isOutput
        ? {
            ...config,
            units: ds.outputLabels.length,
            activation: ds.task === "regression" ? "linear" : "softmax",
            name: `nnv_Output`,
          }
        : config
      addDenseWithFlattenIfNeeded(layerStack, newConfig as LayerConfigMap["Dense"])
    } else if (l.className === "Add") {
      const lastNode = layerStack.last
      const makeLayer = getLayerDef(l.className)!.constructorFunc
      const { otherLayerNames, ...rest } = l.config as LayerConfigMap["Add"]
      const layer = makeLayer(rest)
      const otherNodes = otherLayerNames
        ? (otherLayerNames
            .map((name) => layerStack.getNodeByLayerName(name))
            .filter(Boolean) as tf.SymbolicTensor[])
        : [lastNode] // fallback for initialization
      layerStack.add(layer, [lastNode, ...otherNodes])
    } else if (l.className in layerDefMap) {
      const args = config as LayerConfigMap[typeof l.className]
      const makeLayer = getLayerDef(l.className)?.constructorFunc as (args: unknown) => Layer
      if (makeLayer) layerStack.add(makeLayer(args))
    } else {
      console.log("Unknown layer", l)
    }
  }

  const model = tf.model({
    inputs: input,
    outputs: layerStack.last,
  })

  return model
}

function addDenseWithFlattenIfNeeded(layerStack: LayerStack, denseArgs: LayerConfigMap["Dense"]) {
  const isMultiDim = layerStack.last.shape.length > 2
  if (isMultiDim) {
    layerStack.add(tf.layers.flatten())
  }
  layerStack.add(tf.layers.dense(denseArgs))
}

function isModelCompiled(model: tf.LayersModel) {
  return model.loss !== undefined && model.optimizer !== undefined
}
