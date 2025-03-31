import { getModelEvaluation, getPredictions } from "@/model/training"
import { useSceneStore } from "@/store"
import { useEffect, useState } from "react"
import { Table } from "./ui-elements"
import { isScreen } from "@/utils/screen"
import { ConfusionMatrix } from "./datavis/confusion-matrix"
import { SampleViewer } from "./sample-viewer"

export function EvaluationView() {
  const task = useSceneStore((s) => s.ds?.task)
  if (!task) return null
  if (task === "classification") return <ConfusionViewer />
  else
    return (
      <Evaluation className="fixed [--plot-size:300px] sm:[--plot-size:425px] top-[calc(50vh+var(--plot-size)/2)] left-[50vw] -translate-x-[50%] w-[var(--plot-size)] pt-8" />
    ) /* sm:plotsize = PLOT_SIZE * (2 ** zoom) */
}

function ConfusionViewer() {
  const hasSample = useSceneStore((s) => typeof s.sampleIdx === "number")
  const setSampleIdx = useSceneStore((s) => s.setSampleIdx)
  return (
    <div className="flex w-[calc(100vw-2*var(--padding-main))] justify-center xl:fixed xl:inset-0 xl:max-h-screen xl:min-h-screen xl:items-center">
      <div className="pt-2">
        <div
          className={`${
            hasSample
              ? "-translate-x-[66vw] xl:-translate-x-[50vw] scale-50 "
              : ""
          } transition-transform duration-500 pointer-events-auto`}
          onClick={hasSample ? () => setSampleIdx(undefined) : undefined}
        >
          <ConfusionMatrix />
        </div>
        <SampleViewer />
      </div>
    </div>
  )
}

export function Evaluation({ className = "" }) {
  // TODO: resuse predictions between components
  const data = useEvaluate()
  return (
    <div className={`mt-4 ${className}`}>
      <Table data={data} />
    </div>
  )
}

const LOSS_DICT = {
  meanSquaredError: "MSE",
  meanAbsoluteError: "MAE",
  categoricalCrossentropy: "CCE",
} as Record<string, string>

function useEvaluate() {
  const ds = useSceneStore((s) => s.ds)
  const isRegression = useSceneStore((s) => s.isRegression())
  const model = useSceneStore((s) => s.model)
  const subset = useSceneStore((s) => s.subset)
  const batchCount = useSceneStore((s) => s.batchCount)

  const [data, setData] = useState<Record<string, string | number>>({})

  useEffect(() => {
    async function evaluate() {
      if (!ds || !model) return

      const { loss, accuracy } = await getModelEvaluation(subset)
      const _lossName = typeof model.loss === "string" ? model.loss : ""
      const lossName =
        _lossName && isScreen("sm")
          ? `(${_lossName})`
          : _lossName in LOSS_DICT
          ? `(${LOSS_DICT[_lossName]})`
          : ""
      let newData = {
        Samples: ds[subset].totalSamples,
        [`Loss ${lossName}`]: loss?.toFixed(3),
        Accuracy: accuracy?.toFixed(3),
      } as Record<string, string | number>

      if (isRegression) {
        const result = await getPredictions(subset)
        if (result) {
          newData = {
            ...newData,
            "R²": result.rSquared.toFixed(3),
          }
        }
      }
      setData(newData)
    }
    evaluate()
    return () => setData({})
  }, [batchCount, ds, model, subset, isRegression])
  return data
}
