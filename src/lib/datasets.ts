import { useEffect, useCallback, useState } from "react"
import { useStatusText } from "@/components/status"
import npyjs, { Parsed } from "npyjs"
import JSZip from "jszip"
import * as tf from "@tensorflow/tfjs"
import { debug } from "./debug"
import { create } from "zustand"
import { StandardScaler } from "./normalization"

const n = new npyjs()

type SupportedTypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array

type ParsedSafe = Parsed & { data: SupportedTypedArray }

function isSafe(parsed: Parsed): parsed is ParsedSafe {
  return !(
    parsed.data instanceof BigUint64Array ||
    parsed.data instanceof BigInt64Array
  )
}

export type LayerInput = number[]

interface DatasetData {
  trainX: tf.Tensor<tf.Rank>
  trainY: tf.Tensor<tf.Rank>
  testX?: tf.Tensor<tf.Rank>
  testY?: tf.Tensor<tf.Rank>
  trainXRaw?: tf.Tensor<tf.Rank>
}

type Task = "classification" | "regression"

interface DatasetDef {
  name: string
  task: Task
  description: string
  disabled?: boolean
  aboutUrl: string
  loss: "categoricalCrossentropy" | "meanSquaredError"
  input?: {
    labels?: string[]
  }
  output: {
    size: number
    activation: "softmax" | "linear"
    labels?: string[]
  }
  loadData: () => Promise<DatasetData>
}

export type Dataset = Omit<DatasetDef, "loadData"> & {
  dataRaw?: DatasetData
  data: DatasetData
}

// TODO: use external sources ?

export const datasets: DatasetDef[] = [
  {
    name: "mnist",
    task: "classification",
    description: "Handwritten digits (28x28)",
    aboutUrl: "https://en.wikipedia.org/wiki/MNIST_database",
    loss: "categoricalCrossentropy",
    output: {
      size: 10,
      activation: "softmax",
      labels: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
    },
    loadData: async () => {
      const [xTrain, yTrain, xTest, yTest] = await fetchMutlipleNpzWithProgress(
        [
          "/data/mnist_20k/x_train.npz",
          "/data/mnist_20k/y_train.npz",
          "/data/mnist_20k/x_test.npz",
          "/data/mnist_20k/y_test.npz",
        ]
      )
      return tf.tidy(() => {
        // add channel dimension [,28,28] -> [,28,28,1], needed for Conv2D
        // normalize: vals / 255
        const trainX = tf.tensor(xTrain.data, [...xTrain.shape, 1]).div(255)
        const testX = tf.tensor(xTest.data, [...xTest.shape, 1]).div(255)
        const trainY = tf.oneHot(yTrain.data, 10)
        const testY = tf.oneHot(yTest.data, 10)
        return { trainX, trainY, testX, testY }
      })
    },
  },
  {
    name: "fashion mnist",
    task: "classification",
    description: "Clothing items (28x28)",
    aboutUrl: "https://github.com/zalandoresearch/fashion-mnist",
    loss: "categoricalCrossentropy",
    output: {
      size: 10,
      activation: "softmax",
      labels: [
        "T-shirt/top",
        "Trouser",
        "Pullover",
        "Dress",
        "Coat",
        "Sandal",
        "Shirt",
        "Sneaker",
        "Bag",
        "Ankle boot",
      ],
    },
    loadData: async () => {
      const [xTrain, yTrain, xTest, yTest] = await fetchMutlipleNpzWithProgress(
        [
          "/data/fashion_mnist_20k/x_train.npz",
          "/data/fashion_mnist_20k/y_train.npz",
          "/data/fashion_mnist_20k/x_test.npz",
          "/data/fashion_mnist_20k/y_test.npz",
        ]
      )
      return tf.tidy(() => {
        // add channel dimension [,28,28] -> [,28,28,1], needed for Conv2D
        // normalize: vals / 255
        const trainX = tf.tensor(xTrain.data, [...xTrain.shape, 1]).div(255)
        const testX = tf.tensor(xTest.data, [...xTest.shape, 1]).div(255)
        const trainY = tf.oneHot(yTrain.data, 10)
        const testY = tf.oneHot(yTest.data, 10)
        return { trainX, trainY, testX, testY }
      })
    },
  },
  {
    name: "cifar10",
    task: "classification",
    description: "Color images (32x32x3)",
    disabled: true,
    aboutUrl: "https://www.cs.toronto.edu/~kriz/cifar.html",
    loss: "categoricalCrossentropy",
    output: {
      size: 10,
      activation: "softmax",
      labels: [
        "airplane",
        "automobile",
        "bird",
        "cat",
        "deer",
        "dog",
        "frog",
        "horse",
        "ship",
        "truck",
      ],
    },
    loadData: async () => {
      const [xTrain, yTrain, xTest, yTest] = await fetchMutlipleNpzWithProgress(
        [
          "/data/cifar10_20k/x_train.npz",
          "/data/cifar10_20k/y_train.npz",
          "/data/cifar10_20k/x_test.npz",
          "/data/cifar10_20k/y_test.npz",
        ]
      )
      return tf.tidy(() => {
        // normalize: vals / 255
        const trainX = tf.tensor(xTrain.data, xTrain.shape).div(255)
        const testX = tf.tensor(xTest.data, xTest.shape).div(255)
        const trainY = tf.oneHot(yTrain.data, 10)
        const testY = tf.oneHot(yTest.data, 10)
        return { trainX, trainY, testX, testY }
      })
    },
  },
  {
    name: "california housing",
    task: "regression",
    description: "Predict housing prices (8 features)",
    aboutUrl: "https://keras.io/api/datasets/california_housing/",
    loss: "meanSquaredError",
    input: {
      // TODO ...
      // preprocess: (data) => applyStandardScaler(data as number[][]),
      labels: [
        "longitude",
        "latitude",
        "housing_median_age",
        "total_rooms",
        "total_bedrooms",
        "population",
        "households",
        "median_income",
      ],
    },
    output: {
      size: 1,
      activation: "linear",
      labels: ["median_house_value"],
    },
    loadData: async () => {
      const [xTrain, yTrain, xTest, yTest] = await fetchMutlipleNpzWithProgress(
        [
          "/data/california_housing/x_train.npz",
          "/data/california_housing/y_train.npz",
          "/data/california_housing/x_test.npz",
          "/data/california_housing/y_test.npz",
        ]
      )
      return tf.tidy(() => {
        const trainXRaw = tf.tensor(xTrain.data, xTrain.shape)
        const scaler = new StandardScaler()
        const trainX = scaler.fitTransform(trainXRaw)
        const testX = scaler.transform(tf.tensor(xTest.data, xTest.shape))
        const trainY = tf.tensor(yTrain.data)
        const testY = tf.tensor(yTest.data)
        return { trainXRaw, trainX, trainY, testX, testY }
      })
    },
  },
]

interface DatasetStore {
  datasetKey: string
  setDatasetKey: (key: string) => void
  ds: Dataset | undefined
  setDs: (ds: Dataset | undefined) => void
  i: number // currentSampleIndex
  setI: (arg: number | ((prev: number) => number)) => void
  totalSamples: number
  input: number[] | undefined
  rawInput: number[] | undefined
  trainingY: number | undefined
  isRegression: boolean
}

export const useDatasetStore = create<DatasetStore>((set) => ({
  datasetKey: datasets[0].name,
  setDatasetKey: (key) => set({ datasetKey: key }),
  ds: undefined,
  setDs: (ds) =>
    set(() => {
      const totalSamples = ds?.data.trainX.shape[0] ?? 0
      return {
        ds,
        totalSamples,
        i: Math.floor(Math.random() * totalSamples) || 1,
        isRegression: ds?.output.activation === "linear",
      }
    }),
  i: 1,
  setI: (arg) =>
    set(({ i }) => {
      const newI = typeof arg === "function" ? arg(i) : arg
      return { i: newI }
    }),
  totalSamples: 0,
  isRegression: false,
  // maybe move to separate store (current state + activations ...)
  input: undefined,
  rawInput: undefined,
  trainingY: undefined,
}))

export function useDatasets() {
  const datasetKey = useDatasetStore((s) => s.datasetKey)

  const setStatusText = useStatusText((s) => s.setStatusText)
  const [isLoading, setIsLoading] = useState(false)

  const ds = useDatasetStore((s) => s.ds)
  const setDs = useDatasetStore((s) => s.setDs)

  useEffect(() => {
    setIsLoading(true)
    if (debug()) console.log("loading dataset", datasetKey)
    const datasetDef = datasets.find((d) => d.name === datasetKey)
    if (!datasetDef) return
    let dataRef: DatasetData | undefined = undefined
    datasetDef.loadData().then((data) => {
      dataRef = data
      setIsLoading(false)
      if (debug()) console.log("loaded dataset", datasetKey)
      setDs({
        ...datasetDef,
        data,
      })
    })
    return () => {
      if (dataRef) {
        Object.values(dataRef).forEach((t) => t?.dispose())
      }
      setDs(undefined)
    }
  }, [datasetKey, setStatusText, setIsLoading, setDs])

  const totalSamples = useDatasetStore((s) => s.totalSamples)

  const i = useDatasetStore((s) => s.i)
  const setI = useDatasetStore((s) => s.setI)

  useEffect(() => {
    if (!totalSamples) return
    setI((i) => (i > totalSamples ? totalSamples : i))
  }, [totalSamples, setI])

  useEffect(() => {
    if (!ds) return
    async function getInput() {
      if (!ds) return [undefined, undefined, undefined] as const
      const { trainX, trainXRaw, trainY } = ds.data
      const [, ...dims] = trainX.shape
      const valsPerSample = dims.reduce((a, b) => a * b, 1)
      const index = i - 1
      const [inp, inpRaw, y] = tf.tidy(() => {
        const isOneHot = ds?.output.activation === "softmax"
        const inp = trainX
          .slice([index, 0], [1, ...dims])
          .reshape([valsPerSample]) as tf.Tensor1D
        const inpRaw = trainXRaw
          ?.slice([index, 0], [1, ...dims])
          .reshape([valsPerSample]) as tf.Tensor1D
        const y = isOneHot
          ? (trainY
              .slice([i - 1, 0], [1, ds.output.size])
              .argMax(-1) as tf.Tensor1D)
          : (trainY.slice([i - 1], [1]) as tf.Tensor1D)
        return [inp, inpRaw, y] as const
      })
      try {
        const input = await inp.array()
        const rawInput = await inpRaw?.array()
        const yArr = await y.array()
        const trainingY = Array.isArray(yArr)
          ? yArr[0]
          : (yArr as number | undefined)
        useDatasetStore.setState({ input, rawInput, trainingY })
      } catch (e) {
        console.log("Error getting input", e)
      } finally {
        inp.dispose()
        inpRaw?.dispose()
        y.dispose()
      }
    }
    getInput()
  }, [i, ds])

  // TODO: write store getter for next
  const next = useCallback(
    (step = 1) =>
      setI((i) =>
        i + step <= totalSamples ? i + step : i + step - totalSamples
      ),
    [totalSamples, setI]
  )
  useEffect(() => {
    const prev = () => setI((i) => (i > 1 ? i - 1 : totalSamples))
    const onKeydown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName.toLowerCase() === "input" &&
        document.activeElement?.getAttribute("type") === "text"
      )
        return
      if (e.key === "ArrowRight") next()
      if (e.key === "ArrowLeft") prev()
    }
    window.addEventListener("keydown", onKeydown)
    return () => {
      window.removeEventListener("keydown", onKeydown)
    }
  }, [next, totalSamples, setI])

  return [ds, next, isLoading] as const
}

async function fetchMutlipleNpzWithProgress(paths: string[]) {
  const setStatusText = useStatusText.getState().setStatusText
  const allTotalBytes: number[] = []
  const allLoadedBytes: number[] = []
  const onProgress: OnProgressCb = ({ path, loadedBytes, totalBytes }) => {
    const index = paths.indexOf(path)
    allTotalBytes[index] = totalBytes
    allLoadedBytes[index] = loadedBytes
    const totalLoadedBytes = allLoadedBytes.reduce((a, b) => a + b, 0)
    const totalTotalBytes = allTotalBytes.reduce((a, b) => a + b, 0)
    const percent = totalLoadedBytes / totalTotalBytes
    const text = percent < 1 ? "Loading dataset ..." : "Dataset loaded"
    setStatusText(text, { percent })
  }
  const allPromises = paths.map((path) =>
    fetchWithProgress(path, onProgress, { cache: "force-cache" }).then((r) =>
      r.arrayBuffer()
    )
  )
  const allFiles = await Promise.all(allPromises)
  const allParsed = await Promise.all(allFiles.map(parseNpz))
  return allParsed
}

async function parseNpz(arrayBuffer: ArrayBuffer) {
  // TODO: skip JZip if file is npy
  const zip = await JSZip.loadAsync(arrayBuffer)
  const file = Object.values(zip.files)[0]
  if (!file) throw new Error("No files in zip")
  if (!file.name.endsWith(".npy")) throw new Error("No npy file in zip")
  const data = await file.async("arraybuffer")
  const parsed = n.parse(data)
  if (!isSafe(parsed))
    throw new Error("BigUint64Array/BigInt64Array not supported")
  return parsed
}

export function numColorChannels(ds?: Dataset) {
  return ds?.data.trainX.shape[3] ?? 1
}

type OnProgressCb = (arg: {
  path: string
  percent: number
  loadedBytes: number
  totalBytes: number
}) => void

async function fetchWithProgress(
  path: string,
  onProgress?: OnProgressCb,
  opts?: RequestInit
) {
  const response = await fetch(path, opts)
  const contentLength = response.headers.get("Content-Length")
  if (!contentLength || !response.body) {
    console.error("Content-Length header or body not available.")
    return response
  }
  const totalBytes = parseInt(contentLength, 10)
  onProgress?.({ path, loadedBytes: 0, totalBytes, percent: 0 })
  const reader = response.body.getReader()
  let loadedBytes = 0
  const stream = new ReadableStream({
    async start(controller) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        loadedBytes += value.length
        const percent = loadedBytes / totalBytes
        onProgress?.({ path, loadedBytes, totalBytes, percent })
        controller.enqueue(value)
      }
      controller.close()
      reader.releaseLock()
    },
  })
  const newResponse = new Response(stream)
  return newResponse
}
