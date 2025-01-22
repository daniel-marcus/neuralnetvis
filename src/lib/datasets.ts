import { useEffect, useMemo, useCallback, useState } from "react"
import { useControls } from "leva"
import { useStatusText } from "@/components/status-text"
// import { applyStandardScaler } from "./normalization"
import npyjs, { Parsed } from "npyjs"
import JSZip from "jszip"
import * as tf from "@tensorflow/tfjs"

const n = new npyjs()

export type LayerInput = NodeInput[]
export type NodeInput = number | number[] | number[][] // flat, (width,height), (width,height,channel)

interface DatasetData {
  trainX: Parsed
  trainY: number[]
  testX: Parsed
  testY?: number[]
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
        fetchNpy("/data/mnist/x_train.npz"),
        fetchNpy("/data/mnist/y_train.npz"),
        fetchNpy("/data/mnist/x_test.npz"),
        fetchNpy("/data/mnist/y_test.npz"),
      ])
      const trainX = xTrain // reshapeArray(xTrain)
      const testX = xTest // reshapeArray(xTest)
      return {
        trainX,
        trainY: Array.from(yTrain.data as Uint8Array),
        testX,
        testY: Array.from(yTest.data as Uint8Array),
      }
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
        fetchNpy("/data/cifar10/x_train.npy"),
        fetchNpy("/data/cifar10/y_train.npy"),
        fetchNpy("/data/cifar10/x_test.npy"),
        fetchNpy("/data/cifar10/y_test.npy"),
      ])
      return {
        trainX: xTrain,
        trainY: Array.from(yTrain.data as Uint8Array),
        testX: xTest,
        testY: Array.from(yTest.data as Uint8Array),
      }
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
        fetchNpy("/data/fashion_mnist/x_train.npz"),
        fetchNpy("/data/fashion_mnist/y_train.npz"),
        fetchNpy("/data/fashion_mnist/x_test.npz"),
        fetchNpy("/data/fashion_mnist/y_test.npz"),
      ])
      return {
        trainX: xTrain,
        trainY: Array.from(yTrain.data as Uint8Array),
        testX: xTest,
        testY: Array.from(yTest.data as Uint8Array),
      }
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
  const { datasetId } = useControls("data", {
    datasetId: {
      value: 0,
      label: "dataset",
      options: Object.fromEntries(datasets.map((d, i) => [d.name, i])),
    },
  })

  const setStatusText = useStatusText((s) => s.setStatusText)
  const [isLoading, setIsLoading] = useState(false)
  useEffect(() => {
    if (isLoading) setStatusText("Loading dataset ...")
  }, [isLoading, setStatusText])

  const [ds, setDataset] = useState<Dataset | undefined>(undefined)
  useEffect(() => {
    console.log("loading dataset", datasetId)
    setIsLoading(true)
    const datasetDef = datasets[datasetId]
    if (!datasetDef) return
    datasetDef
      .loadData()
      .then((data) => {
        console.log("loaded dataset", datasetId)
        setDataset({
          ...datasetDef,
          data,
        })
      })
      .finally(() => setIsLoading(false))
    return () => {
      setDataset(undefined)
    }
  }, [datasetId])

  const totalSamples = useMemo(() => ds?.data.trainX.shape[0] ?? 0, [ds])

  const initialRandomIndex = Math.floor(Math.random() * totalSamples)
  const [{ i }, set, get] = useControls(
    "data",
    () => ({
      i: {
        label: "currSample",
        value: initialRandomIndex,
        min: 1,
        max: Math.max(totalSamples, 1),
        step: 1,
      },
    }),
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
    const { data } = ds.data.trainX
    const [, ...dims] = ds.data.trainX.shape
    const valsPerSample = dims.reduce((a, b) => a * b, 1)
    const index = i - 1
    const flatVals = data.slice(
      index * valsPerSample,
      (index + 1) * valsPerSample
    )
    const result = tf
      .tensor(flatVals as unknown as number[], [...dims]) // valsPerSample
      .div(255)
      .arraySync() as LayerInput
    return result
  }, [i, ds])
  const trainingY = useMemo(() => ds?.data.trainY[i - 1], [i, ds])

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
      if (document.activeElement?.tagName.toLowerCase() === "input") return
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

  return [ds, input, trainingY, next] as const
}

async function fetchNpy(path: string): Promise<Parsed> {
  const startTime = new Date().getTime()
  if (path.endsWith(".npy")) {
    const x = await n.load(path)
    const endTime = new Date().getTime()
    console.log(`Loaded ${path} in ${endTime - startTime}ms`)
    return x
  } else if (path.endsWith(".npz")) {
    const response = await fetch(path, {
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
    console.log(`Loaded ${path} in ${endTime - startTime}ms`)
    return parsed
  } else {
    throw new Error("Invalid file extension")
  }
}
