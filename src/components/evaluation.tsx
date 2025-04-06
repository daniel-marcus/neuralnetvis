import { getModelEvaluation, getPredictions } from "@/model/evaluation"
import { useSceneStore } from "@/store"
import { useEffect } from "react"
import { Table } from "./ui-elements"
import { isScreen } from "@/utils/screen"
import { ConfusionMatrix } from "./datavis/confusion-matrix"

export function EvaluationView() {
  const task = useSceneStore((s) => s.ds?.task)
  useEvaluation()
  if (!task) return null
  if (task === "classification") return <ConfusionViewer />
  else
    return (
      <Evaluation className="fixed [--plot-size:300px] sm:[--plot-size:425px] top-[calc(50vh+var(--plot-size)/2)] left-[50vw] -translate-x-[50%] w-[var(--plot-size)] pt-8" />
    ) /* sm:plotsize = PLOT_SIZE * (2 ** zoom) */
}

function useEvaluation() {
  // save prediction & evaluation once in store and make them reusable in MapPlot & Evaluation
  const ds = useSceneStore((s) => s.ds)
  const subset = useSceneStore((s) => s.subset)
  const model = useSceneStore((s) => s.model)
  const batchCount = useSceneStore((s) => s.batchCount)
  const setEvaluation = useSceneStore((s) => s.setEvaluation)
  const resetEvaluation = useSceneStore((s) => s.resetEvaluation)
  useEffect(() => () => resetEvaluation(), [ds, subset, resetEvaluation])
  useEffect(() => {
    async function getPreds() {
      if (!ds || !model) return
      const { loss, accuracy } = await getModelEvaluation(subset)
      const { predictions, rSquared } =
        ds.task === "regression"
          ? (await getPredictions(ds, model, subset)) ?? {}
          : {}
      setEvaluation({ loss, accuracy, rSquared, predictions })
    }
    getPreds()
  }, [ds, subset, model, batchCount, setEvaluation, resetEvaluation])
}

function ConfusionViewer() {
  const hasSample = useSceneStore((s) => typeof s.sampleIdx === "number")
  const setSampleIdx = useSceneStore((s) => s.setSampleIdx)
  return (
    <div
      className={`flex w-[calc(100vw-2*var(--padding-main))] justify-center xl:fixed xl:inset-0 xl:max-h-screen xl:min-h-screen xl:items-center pb-32 xl:p-0 pointer-events-none`}
    >
      <div
        className={`pointer-events-auto ${
          hasSample
            ? "-translate-x-[66vw] xl:-translate-x-[50vw] scale-50 "
            : ""
        } transition-transform duration-500`}
        onClick={hasSample ? () => setSampleIdx(undefined) : undefined}
      >
        <ConfusionMatrix />
      </div>
    </div>
  )
}

const LOSS_DICT = {
  meanSquaredError: "MSE",
  meanAbsoluteError: "MAE",
  categoricalCrossentropy: "CCE",
} as Record<string, string>

export function Evaluation({ className = "" }) {
  const ds = useSceneStore((s) => s.ds)
  const model = useSceneStore((s) => s.model)
  const subset = useSceneStore((s) => s.subset)
  const { loss, accuracy, rSquared } = useSceneStore((s) => s.evaluation)

  const _lossName = typeof model?.loss === "string" ? model.loss : ""
  const lossName =
    _lossName && isScreen("sm")
      ? `(${_lossName})`
      : _lossName in LOSS_DICT
      ? `(${LOSS_DICT[_lossName]})`
      : ""

  return (
    <div className={`mt-4 ${className}`}>
      <Table
        data={{
          Samples: ds?.[subset].totalSamples,
          [`Loss ${lossName}`]: loss?.toFixed(3),
          Accuracy: accuracy?.toFixed(3),
          "R²": rSquared?.toFixed(3),
        }}
      />
    </div>
  )
}
