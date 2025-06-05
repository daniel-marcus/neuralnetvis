import { useEffect } from "react"
import { useSceneStore } from "@/store"
import { getModelEvaluation, getPredictions } from "@/model/evaluation"
import { isScreen } from "@/utils/screen"
import { Table } from "@/components/ui-elements"
import { ConfusionMatrix } from "./confusion-matrix"
import { SampleViewer } from "../sample-viewer"
import { Portal } from "@/components/portal"
import { sampleViewerPortal } from "@/components/status-bar"

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
        (await getPredictions(ds, model, subset)) ?? {}
      setEvaluation({ loss, accuracy, rSquared, predictions })
    }
    getPreds()
  }, [ds, subset, model, batchCount, setEvaluation, resetEvaluation])
}

export function useHasSample() {
  // to hide the ConfusionViewer when a sample is selected
  return useSceneStore((s) => typeof s.sampleIdx === "number")
}

function ConfusionViewer() {
  const hasSample = useHasSample()
  const setSampleIdx = useSceneStore((s) => s.setSampleIdx)
  return (
    <div className={`pointer-events-none pb-8`}>
      <div
        className={`pointer-events-auto ${
          hasSample
            ? "-translate-x-[66vw] xl:-translate-x-[50vw] scale-10 max-w-screen max-h-screen overflow-clip"
            : ""
        } transition-transform duration-500 mx-auto`}
        onClick={hasSample ? () => setSampleIdx(undefined) : undefined}
      >
        <ConfusionMatrix />
      </div>
      {!hasSample && (
        <div className="sticky left-0 w-screen p-main">
          <Evaluation className="my-4 max-w-[500px] mx-auto" />
        </div>
      )}
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

  const rmse =
    _lossName === "meanSquaredError" && typeof loss === "number"
      ? Math.sqrt(loss)
      : undefined

  return (
    <div className={`mt-4 ${className}`}>
      <Table
        data={{
          Samples: ds?.[subset].totalSamples,
          [`Loss ${lossName}`]: loss?.toFixed(3),
          [`Loss (RMSE)`]: rmse?.toFixed(3),
          Accuracy: accuracy?.toFixed(3),
          "R²": rSquared?.toFixed(3),
        }}
      />
    </div>
  )
}
