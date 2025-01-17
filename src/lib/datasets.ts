import { useEffect, useMemo, useCallback, useState } from "react"
import { useControls } from "leva"
import { useStatusText } from "@/components/status-text"

// TODO: use only 1 dataset and set training split / sampleSize manually

interface DatasetData {
  trainData: number[][]
  trainLabels: number[]
  testData: number[][]
  testLabels: number[]
}
interface DatasetDef {
  name: string
  labelNames?: string[]
  loadData: () => Promise<DatasetData>
}

export type Dataset = Omit<DatasetDef, "loadData"> & DatasetData

// TODO: normalize somewhere else?
// TODO: use external sources

const loadMNISTData = async () => {
  const [trainData, trainLabels, testData, testLabels] = await Promise.all([
    import("@/data/mnist/train_data.json"),
    import("@/data/mnist/train_labels.json"),
    import("@/data/mnist/test_data.json"),
    import("@/data/mnist/test_labels.json"),
  ])
  return {
    trainData: (trainData.default as number[][]).map(normalize),
    trainLabels: trainLabels.default,
    testData: testData.default.map(normalize),
    testLabels: testLabels.default,
  }
}

const loadFashionMNISTData = async () => {
  const [trainData, trainLabels, testData, testLabels] = await Promise.all([
    import("@/data/fashion_mnist/train_data.json"),
    import("@/data/fashion_mnist/train_labels.json"),
    import("@/data/fashion_mnist/test_data.json"),
    import("@/data/fashion_mnist/test_labels.json"),
  ])
  return {
    trainData: (trainData.default as number[][]).map(normalize),
    trainLabels: trainLabels.default,
    testData: testData.default.map(normalize),
    testLabels: testLabels.default,
  }
}

const datasets: DatasetDef[] = [
  {
    name: "mnist",
    loadData: loadMNISTData,
  },
  {
    name: "fashion mnist",
    loadData: loadFashionMNISTData,
    labelNames: [
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

  const dsFull = useMemo(() => {
    if (dataset) return dataset
    return {
      name: "Loading ...",
      trainData: [],
      trainLabels: [],
      testData: [],
      testLabels: [],
    } as Dataset
  }, [dataset])

  const { sampleSize } = useControls(
    "data",
    {
      sampleSize: {
        value: 5000,
        min: 1,
        max: dsFull.trainData.length ? dsFull.trainData.length - 1 : 5000, // TODO: display values > 10,000
        step: 100,
      },
    },
    [dsFull]
  )

  const ds = useMemo(() => {
    return {
      ...dsFull,
      trainData: dsFull.trainData.slice(0, sampleSize),
      trainLabels: dsFull.trainLabels.slice(0, sampleSize),
    }
  }, [dsFull, sampleSize])

  // TODO: reset i on ds change
  const initialRandomIndex = Math.floor(Math.random() * ds.trainData.length)
  const [{ i }, set, get] = useControls(
    "data",
    () => ({
      i: {
        label: "currIndex",
        value: initialRandomIndex,
        min: 0,
        max: Math.max(ds.trainData.length - 1, 0),
        step: 1,
      },
    }),
    [ds]
  )
  const setI = useCallback(
    (arg: number | ((prev: number) => number)) => {
      const currI = get("i")
      const newI = typeof arg === "function" ? arg(currI) : arg
      set({ i: newI })
    },
    [set, get]
  )

  const input = useMemo(() => ds.trainData[i], [i, ds])
  const label = useMemo(() => ds.trainLabels[i], [i, ds])

  const next = useCallback(
    (step = 1) =>
      setI((i) =>
        i + step < ds.trainData.length
          ? i + step
          : i + step - ds.trainData.length
      ),
    [ds, setI]
  )
  useEffect(() => {
    const prev = () => setI((i) => (i > 0 ? i - 1 : ds.trainData.length - 1))
    const onKeydown = (e: KeyboardEvent) => {
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
  return [input, label, next, ds] as const
}

export function normalize(data: number[] | unknown) {
  if (!Array.isArray(data)) return [] as number[]
  const max = Math.max(...data)
  return data.map((d) => d / max)
}
