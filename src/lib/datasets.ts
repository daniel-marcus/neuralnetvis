import { useEffect, useMemo, useCallback, useState } from "react"
import { useControls } from "leva"
import { useStatusText } from "@/components/status-text"
// import { applyStandardScaler } from "./normalization"
import npyjs, { Parsed } from "npyjs"
import JSZip from "jszip"

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
    preprocess?: (data: DataType[]) => DataType[] // TODO: fix typing
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
    name: "cifar10",
    loss: "categoricalCrossentropy",
    input: {
      preprocess: (input) => {
        if (Array.isArray(input[0]))
          // TODO: use all channels!
          return (input as ColorPixel[]).map(
            (pixel) => pixel.map((v) => v / 255) as ColorPixel
          )
        else return input
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
      const [xTrain, yTrain, xTest, yTest] = await Promise.all([
        fetchNpy("/data/cifar10/x_train.npy"),
        fetchNpy("/data/cifar10/y_train.npy"),
        fetchNpy("/data/cifar10/x_test.npy"),
        fetchNpy("/data/cifar10/y_test.npy"),
      ])
      const trainX = reshapeArray(xTrain)
      const testX = reshapeArray(xTest)
      return {
        trainX,
        trainY: Array.from(yTrain.data as Uint8Array),
        testX,
        testY: Array.from(yTest.data as Uint8Array),
      }
    },
  },
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
      const trainX = reshapeArray(xTrain)
      const testX = reshapeArray(xTest)
      return {
        trainX,
        trainY: Array.from(yTrain.data as Uint8Array),
        testX,
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
      const trainX = reshapeArray(xTrain)
      const testX = reshapeArray(xTest)
      return {
        trainX,
        trainY: Array.from(yTrain.data as Uint8Array),
        testX,
        testY: Array.from(yTest.data as Uint8Array),
      }
    },
  },
  {
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
          data,
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

  const rawInput = useMemo(() => ds.data.trainX[i - 1], [i, ds])
  const input = useMemo(() => {
    if (!ds.input?.preprocess) return rawInput
    return ds.input.preprocess(rawInput)
  }, [rawInput, ds])

  // const rawInput = useMemo(() => ds.dataRaw?.trainX[i - 1], [i, ds])
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

function reshapeArray(parsed: Parsed) {
  // TODO fix typing / keep Array type for memory efficiency?
  const x = parsed.data as unknown as number[]
  const shape = parsed.shape
  // const numImages = shape[0]
  const width = shape[1]
  const height = shape[2]
  const channels = shape[3] ?? 1 // 1 or 3
  const valuesPerImage = width * height * channels
  const numImages = x.length / valuesPerImage

  const returnX: (number | ColorPixel)[][] = []
  for (let i = 0; i < numImages; i++) {
    const imageStart = i * valuesPerImage
    const image: (number | ColorPixel)[] = []
    for (let row = 0; row < width; row++) {
      for (let col = 0; col < width; col++) {
        const pixelStart = imageStart + (row * width + col) * channels
        const pixel =
          channels === 1
            ? x[pixelStart]
            : ([
                x[pixelStart],
                x[pixelStart + 1],
                x[pixelStart + 2],
              ] as ColorPixel)
        // TODO: don't flatten
        image.push(pixel)
      }
    }
    returnX.push(image)
  }
  return returnX
}
