import { useEffect, useMemo, useCallback, useState } from "react"
import { useControls } from "leva"
import { useStatusText } from "@/components/status-text"

interface DatasetData {
  trainX: number[][]
  trainY: number[]
  testX: number[][]
  testY: number[]
}
interface DatasetDef {
  name: string
  loss: "categoricalCrossentropy" | "meanSquaredError"
  output: {
    size: number
    activation: "softmax" | "linear"
    labels?: string[]
  }
  loadData: () => Promise<DatasetData>
}

export type Dataset = Omit<DatasetDef, "loadData"> & DatasetData

// TODO: normalize somewhere else?
// TODO: use external sources

const datasets: DatasetDef[] = [
  {
    name: "mnist",
    loss: "categoricalCrossentropy",
    output: {
      size: 10,
      activation: "softmax",
      labels: Array.from({ length: 10 }, (_, i) => i.toString()),
    },
    loadData: async () => {
      const [trainX, trainY, testX, testY] = await Promise.all([
        import("@/data/mnist/train_data.json"),
        import("@/data/mnist/train_labels.json"),
        import("@/data/mnist/test_data.json"),
        import("@/data/mnist/test_labels.json"),
      ])
      return {
        trainX: (trainX.default as number[][]).map(normalize),
        trainY: trainY.default,
        testX: testX.default.map(normalize),
        testY: testY.default,
      }
    },
  },
  {
    name: "fashion mnist",
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
      const [trainX, trainY, testX, testY] = await Promise.all([
        import("@/data/fashion_mnist/train_data.json"),
        import("@/data/fashion_mnist/train_labels.json"),
        import("@/data/fashion_mnist/test_data.json"),
        import("@/data/fashion_mnist/test_labels.json"),
      ])
      return {
        trainX: (trainX.default as number[][]).map(normalize),
        trainY: trainY.default,
        testX: testX.default.map(normalize),
        testY: testY.default,
      }
    },
  },
  {
    name: "california housing",
    loss: "meanSquaredError",
    output: {
      size: 1,
      activation: "linear",
    },
    loadData: async () => {
      const [trainX, trainY, testX, testY] = await Promise.all([
        import("@/data/california_housing/train_X.json"),
        import("@/data/california_housing/train_y.json"),
        import("@/data/california_housing/test_X.json"),
        import("@/data/california_housing/test_y.json"),
      ])
      const [scaledTrainX, means, stdDevs] = applyStandardScaler(trainX.default)
      const [scaledTextX] = applyStandardScaler(testX.default, means, stdDevs)
      return {
        trainX: scaledTrainX,
        trainY: trainY.default,
        testX: scaledTextX,
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
    setIsLoading(true)
    const datasetDef = datasets[datasetId]
    if (!datasetDef) return
    datasetDef
      .loadData()
      .then((data) => {
        setDataset({
          ...datasetDef,
          ...data,
        })
      })
      .finally(() => setIsLoading(false))
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
      trainX: [],
      trainY: [],
      testX: [],
      testY: [],
    } as Dataset
  }, [dataset])

  const initialRandomIndex = Math.floor(Math.random() * ds.trainX.length)
  const [{ i }, set, get] = useControls(
    "data",
    () => ({
      i: {
        label: "currSample",
        value: initialRandomIndex,
        min: 1,
        max: Math.max(ds.trainX.length, 1),
        step: 1,
      },
    }),
    [ds]
  )
  useEffect(() => {
    const currI = get("i")
    if (currI > ds.trainX.length) set({ i: ds.trainX.length })
  }, [ds, get, set])

  const setI = useCallback(
    (arg: number | ((prev: number) => number)) => {
      const currI = get("i")
      const newI = typeof arg === "function" ? arg(currI) : arg
      set({ i: newI })
    },
    [set, get]
  )

  const input = useMemo(() => ds.trainX[i - 1], [i, ds])
  const trainingY = useMemo(() => ds.trainY[i - 1], [i, ds])

  const next = useCallback(
    (step = 1) =>
      setI((i) =>
        i + step <= ds.trainX.length ? i + step : i + step - ds.trainX.length
      ),
    [ds, setI]
  )
  useEffect(() => {
    const prev = () => setI((i) => (i > 1 ? i - 1 : ds.trainX.length))
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

  return [input, trainingY, next, ds] as const
}

export function normalize(data: number[] | unknown) {
  if (!Array.isArray(data)) return [] as number[]
  const max = Math.max(...data)
  return data.map((d) => d / max)
}

export function standardize(column: number[], mean?: number, stdDev?: number) {
  mean = mean ?? column.reduce((acc, v) => acc + v, 0) / column.length
  stdDev =
    stdDev ??
    Math.sqrt(
      column.reduce((acc, v) => acc + (v - mean) ** 2, 0) / column.length
    )
  const zScaled = column.map((v) => (v - mean) / stdDev)
  return [zScaled, mean, stdDev] as const
}

export function applyStandardScaler(
  data: number[][],
  means?: number[],
  stdDevs?: number[]
) {
  const colums = data[0].map((_, j) => data.map((row) => row[j]))
  const scaled = colums.map((col, i) =>
    standardize(col, means?.[i], stdDevs?.[i])
  )
  const returnData = scaled.map((s) => s[0])
  const returnMeans = scaled.map((s) => s[1])
  const returnStdDevs = scaled.map((s) => s[2])
  return [returnData, returnMeans, returnStdDevs] as const
}
