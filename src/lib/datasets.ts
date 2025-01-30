import { useEffect, useMemo, useCallback, useState } from "react"
import { useControls } from "leva"
import { useStatusText } from "@/components/status-text"
// import { applyStandardScaler } from "./normalization"
import npyjs, { Parsed } from "npyjs"
import JSZip from "jszip"
import * as tf from "@tensorflow/tfjs"
import { debug } from "./debug"
import { useControlStores } from "@/components/controls"

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

export type LayerInput = NodeInput[]
export type NodeInput = number | number[] | number[][] // flat, (width,height), (width,height,channel)

interface DatasetData {
  trainX: tf.Tensor<tf.Rank>
  trainY: tf.Tensor<tf.Rank>
  testX?: tf.Tensor<tf.Rank>
  testY?: tf.Tensor<tf.Rank>
}

interface DatasetDef {
  name: string
  loss: "categoricalCrossentropy" | "meanSquaredError"
  input?: {
    labels?: string[]
    preprocess?: (data: LayerInput) => LayerInput // TODO: fix typing
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

const datasets: DatasetDef[] = [
  {
    name: "mnist",
    loss: "categoricalCrossentropy",
    input: {
      preprocess: (input) => {
        return (input as number[]).map((v) => v / 255)
      },
    },
    output: {
      size: 10,
      activation: "softmax",
      labels: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
    },
    loadData: async () => {
      const [xTrain, yTrain, xTest, yTest] = await Promise.all([
        fetchNpy("/data/mnist_20k/x_train.npz"),
        fetchNpy("/data/mnist_20k/y_train.npz"),
        fetchNpy("/data/mnist_20k/x_test.npz"),
        fetchNpy("/data/mnist_20k/y_test.npz"),
      ])
      // add channel dimension [,28,28] -> [,28,28,1], needed for Conv2D
      // normalize: vals / 255
      const trainX = tf.tensor(xTrain.data, [...xTrain.shape, 1]).div(255)
      const testX = tf.tensor(xTest.data, [...xTest.shape, 1]).div(255)
      const trainY = tf.oneHot(yTrain.data, 10)
      const testY = tf.oneHot(yTest.data, 10)
      return { trainX, trainY, testX, testY }
    },
  },
  {
    name: "fashion mnist",
    loss: "categoricalCrossentropy",
    input: {
      preprocess: (input) => {
        return (input as number[]).map((v) => v / 255)
      },
    },
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
      const [xTrain, yTrain, xTest, yTest] = await Promise.all([
        fetchNpy("/data/fashion_mnist_20k/x_train.npz"),
        fetchNpy("/data/fashion_mnist_20k/y_train.npz"),
        fetchNpy("/data/fashion_mnist_20k/x_test.npz"),
        fetchNpy("/data/fashion_mnist_20k/y_test.npz"),
      ])
      // add channel dimension [,28,28] -> [,28,28,1], needed for Conv2D
      // normalize: vals / 255
      const trainX = tf.tensor(xTrain.data, [...xTrain.shape, 1]).div(255)
      const testX = tf.tensor(xTest.data, [...xTest.shape, 1]).div(255)
      const trainY = tf.oneHot(yTrain.data, 10)
      const testY = tf.oneHot(yTest.data, 10)
      return { trainX, trainY, testX, testY }
    },
  },
  {
    name: "cifar10",
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
      const [xTrain, yTrain, xTest, yTest] = await Promise.all([
        fetchNpy("/data/cifar10_20k/x_train.npz"),
        fetchNpy("/data/cifar10_20k/y_train.npz"),
        fetchNpy("/data/cifar10_20k/x_test.npz"),
        fetchNpy("/data/cifar10_20k/y_test.npz"),
      ])
      // normalize: vals / 255
      const trainX = tf.tensor(xTrain.data, xTrain.shape).div(255)
      const testX = tf.tensor(xTest.data, xTest.shape).div(255)
      const trainY = tf.oneHot(yTrain.data, 10)
      const testY = tf.oneHot(yTest.data, 10)
      return { trainX, trainY, testX, testY }
    },
  },
  /* {
    name: "california housing",
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
      const [trainX, trainY, testX, testY] = await Promise.all([
        import("@/data/california_housing/train_X.json"),
        import("@/data/california_housing/train_y.json"),
        import("@/data/california_housing/test_X.json"),
        import("@/data/california_housing/test_y.json"),
      ])
      return {
        trainX: trainX.default,
        trainY: trainY.default,
        testX: testX.default,
        testY: testY.default,
      }
    },
  }, */
]

export function useDatasets() {
  const { dataStore } = useControlStores()
  const { datasetId } = useControls(
    {
      datasetId: {
        value: 0,
        label: "dataset",
        options: Object.fromEntries(datasets.map((d, i) => [d.name, i])),
      },
    },
    { store: dataStore }
  )

  const setStatusText = useStatusText((s) => s.setStatusText)
  const [isLoading, setIsLoading] = useState(false)

  const [ds, setDataset] = useState<Dataset | undefined>(undefined)
  useEffect(() => {
    setStatusText("Loading dataset ...")
    setIsLoading(true)
    if (debug()) console.log("loading dataset", datasetId)
    const datasetDef = datasets[datasetId]
    if (!datasetDef) return
    datasetDef.loadData().then((data) => {
      setIsLoading(false)
      if (debug()) console.log("loaded dataset", datasetId)
      setDataset({
        ...datasetDef,
        data,
      })
    })
    return () => {
      setDataset(undefined)
    }
  }, [datasetId, setStatusText, setIsLoading])

  const totalSamples = useMemo(() => ds?.data.trainX.shape[0] ?? 0, [ds])

  const initialRandomIndex = Math.floor(Math.random() * totalSamples)
  const [{ i }, set, get] = useControls(
    () => ({
      i: {
        label: "currSample",
        value: initialRandomIndex,
        min: 1,
        max: Math.max(totalSamples, 1),
        step: 1,
      },
    }),
    { store: dataStore },
    [totalSamples]
  )
  useEffect(() => {
    const currI = get("i")
    if (currI > totalSamples) set({ i: totalSamples })
  }, [totalSamples, get, set])

  const setI = useCallback(
    (arg: number | ((prev: number) => number)) => {
      const currI = get("i")
      const newI = typeof arg === "function" ? arg(currI) : arg
      set({ i: newI })
    },
    [set, get]
  )

  const input = useMemo(() => {
    if (!ds) return
    const { trainX } = ds.data
    const [, ...dims] = trainX.shape
    const valsPerSample = dims.reduce((a, b) => a * b, 1)
    const index = i - 1
    // todo: read async?
    const sampleFlat = tf.tidy(
      () =>
        trainX
          .slice([index, 0, 0, 0], [1, ...dims])
          .reshape([valsPerSample])
          .arraySync() as number[]
    )

    return sampleFlat
  }, [i, ds])

  const trainingY = useMemo(() => {
    // TODO: check if is one-hot or not
    const y = tf.tidy(() => {
      const res = ds?.data.trainY
        .slice([i - 1, 0], [1, ds.output.size])
        .argMax(-1)
        .arraySync()
      return (res && Array.isArray(res) ? res[0] : undefined) as
        | number
        | undefined
    })
    return y
  }, [i, ds])

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
    const l = 0 // setInterval(next, 1000)
    window.addEventListener("keydown", onKeydown)
    return () => {
      window.removeEventListener("keydown", onKeydown)
      clearInterval(l)
    }
  }, [next, totalSamples, setI])

  return [ds, isLoading, input, trainingY, next] as const
}

async function fetchNpy(path: string): Promise<ParsedSafe> {
  const startTime = new Date().getTime()
  // TODO: error handling
  if (path.endsWith(".npy")) {
    const parsed = await n.load(path)
    const endTime = new Date().getTime()
    if (debug()) console.log(`Loaded ${path} in ${endTime - startTime}ms`)
    if (!isSafe(parsed))
      throw new Error("BigUint64Array/BigInt64Array not supported")
    return parsed
  } else if (path.endsWith(".npz")) {
    const response = await fetch(path, {
      // TODO: cache invalidation when files change?
      cache: "force-cache",
    })
    const arrayBuffer = await response.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)
    const file = Object.values(zip.files)[0]
    if (!file) throw new Error("No files in zip")
    if (!file.name.endsWith(".npy")) throw new Error("No npy file in zip")
    const data = await file.async("arraybuffer")
    const parsed = n.parse(data)
    const endTime = new Date().getTime()
    if (debug()) console.log(`Loaded ${path} in ${endTime - startTime}ms`)
    if (!isSafe(parsed))
      throw new Error("BigUint64Array/BigInt64Array not supported")
    return parsed
  } else {
    throw new Error("Invalid file extension")
  }
}

export function numColorChannels(ds?: Dataset) {
  return ds?.data.trainX.shape[3] ?? 1
}
