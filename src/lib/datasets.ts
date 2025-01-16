import { useEffect, useMemo, useState, useCallback } from "react"
import { useControls } from "leva"

import trainData from "@/data/mnist/train_data.json"
import trainLabels from "@/data/mnist/train_labels.json"
import testData from "@/data/mnist/test_data.json"
import testLabels from "@/data/mnist/test_labels.json"

// TODO: use only 1 dataset and set training split / sampleSize manually
export interface Dataset {
  name: string
  trainData: number[][]
  trainLabels: number[]
  testData: number[][]
  testLabels: number[]
}

const datasets: Dataset[] = [
  {
    name: "mnist",
    trainData: (trainData as number[][]).map(normalize),
    trainLabels: trainLabels.map((l) => l[0]), // TODO
    testData: (testData as number[][]).map(normalize),
    testLabels: testLabels.map((l) => l[0]), // TODO
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

  const { sampleSize } = useControls(
    "data",
    {
      sampleSize: {
        value: 2000,
        min: 1,
        max: datasets[datasetId].trainData.length,
        step: 100,
      },
    },
    [datasetId]
  )

  const ds = useMemo(
    () => ({
      ...datasets[datasetId],
      trainData: datasets[datasetId].trainData.slice(0, sampleSize),
      trainLabels: datasets[datasetId].trainLabels.slice(0, sampleSize),
    }),
    [datasetId, sampleSize]
  )

  // TODO: reset i on ds change
  const initialRandomIndex = Math.floor(Math.random() * ds.trainData.length)
  const [i, setI] = useState(initialRandomIndex)
  const input = useMemo(() => ds.trainData[i], [i, ds])
  const label = useMemo(() => ds.trainLabels[i], [i, ds])

  const next = useCallback(
    (step = 1) => setI((i) => (i + step < ds.trainData.length ? i + step : 0)),
    [ds]
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
  }, [next, ds])
  return [input, label, next, ds] as const
}

export function normalize(data: number[] | unknown) {
  if (!Array.isArray(data)) return [] as number[]
  const max = Math.max(...data)
  return data.map((d) => d / max)
}
