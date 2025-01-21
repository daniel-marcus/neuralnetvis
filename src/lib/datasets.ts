import { useEffect, useMemo, useCallback, useState } from "react"
import { useControls } from "leva"
import { useStatusText } from "@/components/status-text"
import { applyStandardScaler } from "./normalization"

interface DatasetData {
  trainX: number[][]
  trainY: number[]
  testX: number[][]
  testY: number[]
}

interface DatasetDef {
  name: string
  loss: "categoricalCrossentropy" | "meanSquaredError"
  input?: {
    labels?: string[]
    preprocess?: (data: number[][]) => number[][]
  }
  output: {
    size: number
    activation: "softmax" | "linear"
    labels?: string[]
  }
  loadData: () => Promise<DatasetData>
}

export type Dataset = Omit<DatasetDef, "loadData"> & {
  dataRaw: DatasetData
  data: DatasetData
}

// TODO: use external sources

const MNIST_SIZE: "10k" | "20k" = "20k"
const FASHION_MNIST_SIZE: "10k" | "60k" = "60k"

const datasets: DatasetDef[] = [
  {
    name: "mnist",
    loss: "categoricalCrossentropy",
    input: {
      preprocess: (data) => data.map((row) => row.map((v) => v / 255)),
    },
    output: {
      size: 10,
      activation: "softmax",
      labels: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
    },
    loadData: async () => {
      const [trainX, trainY, testX, testY] = await Promise.all([
        import(`@/data/mnist/${MNIST_SIZE}/train_data.json`),
        import(`@/data/mnist/${MNIST_SIZE}/train_labels.json`),
        import(`@/data/mnist/${MNIST_SIZE}/test_data.json`),
        import(`@/data/mnist/${MNIST_SIZE}/test_labels.json`),
      ])
      return {
        trainX: trainX.default as number[][],
        trainY: trainY.default as number[],
        testX: testX.default as number[][],
        testY: testY.default as number[],
      }
    },
  },
  {
    name: "fashion mnist",
    loss: "categoricalCrossentropy",
    input: {
      preprocess: (data) => data.map((row) => row.map((v) => v / 255)),
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
      const [trainX, trainY, testX, testY] = await Promise.all([
        import(`@/data/fashion_mnist/${FASHION_MNIST_SIZE}/train_data.json`),
        import(`@/data/fashion_mnist/${FASHION_MNIST_SIZE}/train_labels.json`),
        import(`@/data/fashion_mnist/${FASHION_MNIST_SIZE}/test_data.json`),
        import(`@/data/fashion_mnist/${FASHION_MNIST_SIZE}/test_labels.json`),
      ])
      return {
        trainX: trainX.default as number[][],
        trainY: trainY.default,
        testX: testX.default as number[][],
        testY: testY.default,
      }
    },
  },
  {
    name: "california housing",
    loss: "meanSquaredError",
    input: {
      preprocess: applyStandardScaler,
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
  },
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

  const [dataset, setDataset] = useState<Dataset | null>(null)
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
          dataRaw: data,
          data: {
            // apply preprocess if available
            ...data,
            trainX: datasetDef.input?.preprocess
              ? datasetDef.input.preprocess(data.trainX)
              : data.trainX,
            testX: datasetDef.input?.preprocess
              ? datasetDef.input.preprocess(data.testX)
              : data.testX,
          },
        })
      })
      .finally(() => setIsLoading(false))
    return () => {
      setDataset(null)
    }
  }, [datasetId])

  const ds = useMemo(() => {
    if (dataset) return dataset
    return {
      name: "Loading ...",
      loss: "categoricalCrossentropy",
      output: {
        size: 10,
        activation: "softmax",
      },
      dataRaw: { trainX: [], trainY: [], testX: [], testY: [] },
      data: { trainX: [], trainY: [], testX: [], testY: [] },
    } as Dataset
  }, [dataset])

  const initialRandomIndex = Math.floor(Math.random() * ds.data.trainX.length)
  const [{ i }, set, get] = useControls(
    "data",
    () => ({
      i: {
        label: "currSample",
        value: initialRandomIndex,
        min: 1,
        max: Math.max(ds.data.trainX.length, 1),
        step: 1,
      },
    }),
    [ds]
  )
  useEffect(() => {
    const currI = get("i")
    if (currI > ds.data.trainX.length) set({ i: ds.data.trainX.length })
  }, [ds, get, set])

  const setI = useCallback(
    (arg: number | ((prev: number) => number)) => {
      const currI = get("i")
      const newI = typeof arg === "function" ? arg(currI) : arg
      set({ i: newI })
    },
    [set, get]
  )

  const input = useMemo(() => ds.data.trainX[i - 1], [i, ds])
  const rawInput = useMemo(() => ds.dataRaw.trainX[i - 1], [i, ds])
  const trainingY = useMemo(() => ds.data.trainY[i - 1], [i, ds])

  const next = useCallback(
    (step = 1) =>
      setI((i) =>
        i + step <= ds.data.trainX.length
          ? i + step
          : i + step - ds.data.trainX.length
      ),
    [ds, setI]
  )
  useEffect(() => {
    const prev = () => setI((i) => (i > 1 ? i - 1 : ds.data.trainX.length))
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
  }, [next, ds, setI])

  return [input, rawInput, trainingY, next, ds] as const
}
