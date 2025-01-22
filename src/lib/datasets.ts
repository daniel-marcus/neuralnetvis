import { useEffect, useMemo, useCallback, useState } from "react"
import { useControls } from "leva"
import { useStatusText } from "@/components/status-text"
import { applyStandardScaler } from "./normalization"
import npyjs, { Parsed } from "npyjs"

const n = new npyjs()

type ColorPixel = [number, number, number]
export type DataType = number | ColorPixel

interface DatasetData {
  trainX: DataType[][]
  trainY: number[]
  testX?: DataType[][]
  testY?: number[]
}

interface DatasetDef {
  name: string
  loss: "categoricalCrossentropy" | "meanSquaredError"
  input?: {
    labels?: string[]
    preprocess?: (data: DataType[][]) => DataType[][] // TODO: fix typing
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
    name: "cifar10",
    loss: "categoricalCrossentropy",
    input: {
      preprocess: (data) => {
        if (Array.isArray(data[0][0]))
          return (data as ColorPixel[][]).map((row) => row.map((v) => v[0]))
        else return data
      },
    },
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
      const x = await n.load("/data/cifar10/x_train.npy")
      const y = await n.load("/data/cifar10/y_train.npy")
      const xTest = await n.load("/data/cifar10/x_test.npy")
      const yText = await n.load("/data/cifar10/y_test.npy")
      const trainX = reshapeCifar10(x)
      const testX = reshapeCifar10(xTest)
      return {
        trainX,
        trainY: Array.from(y.data as Uint8Array),
        testX,
        testY: Array.from(yText.data as Uint8Array),
      }
    },
  },
  {
    name: "mnist",
    loss: "categoricalCrossentropy",
    input: {
      preprocess: (data) => {
        return (data as number[][]).map((row) => row.map((v) => v / 255))
      },
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
      preprocess: (data) =>
        (data as number[][]).map((row) => row.map((v) => v / 255)),
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
      preprocess: (data) => applyStandardScaler(data as number[][]),
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
              ? datasetDef.input.preprocess(data.trainX as number[][]) // TODO: fix typing
              : data.trainX,
            testX:
              datasetDef.input?.preprocess && data.testX
                ? datasetDef.input.preprocess(data.testX as number[][]) // TODO: fix typing
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

function reshapeCifar10(x: Parsed) {
  const xData = x.data as unknown as number[]
  const imageWidth = 32
  const imageHeight = 32
  const channels = 3
  const pixelsPerImage = imageWidth * imageHeight
  const valuesPerImage = pixelsPerImage * channels
  const numImages = x.data.length / valuesPerImage

  const returnX: ColorPixel[][] = []
  for (let i = 0; i < numImages; i++) {
    const imageStart = i * valuesPerImage
    const image: ColorPixel[] = []
    for (let row = 0; row < imageHeight; row++) {
      for (let col = 0; col < imageWidth; col++) {
        const pixelStart = imageStart + (row * imageWidth + col) * channels
        const pixel: ColorPixel = [
          xData[pixelStart],
          xData[pixelStart + 1],
          xData[pixelStart + 2],
        ]
        image.push(pixel)
      }
    }
    returnX.push(image)
  }
  return returnX
}
