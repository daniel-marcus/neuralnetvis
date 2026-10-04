import { useEffect } from "react"
import { useSceneStore } from "@/store"
import { getEvaluation } from "@/model/evaluation"
import { isScreen } from "@/utils/screen"
import { Table } from "@/components/ui-elements"
import { ConfusionMatrix } from "./confusion-matrix"

export function EvaluationView() {
  const task = useSceneStore((s) => s.ds?.task)
  useEvaluation()
  if (!task) return null
  if (task === "classification") return <ConfusionViewer />
  else if (task === "nextToken")
    return (
      <Evaluation className="fixed top-[50vh] left-[50vw] translate-x-[-50%] translate-y-[-50%] w-75 sm:w-106" />
    )
  else
    return (
      <Evaluation className="fixed [--plot-size:300px] sm:[--plot-size:425px] top-[calc(50vh+var(--plot-size)/2)] left-[50vw] translate-x-[-50%] w-(--plot-size) pt-8" />
    ) /* sm:plotsize = PLOT_SIZE * (2 ** zoom) */
}

function useEvaluation() {
  // save prediction & evaluation once in store and make them reusable in MapPlot & Evaluation
  const ds = useSceneStore((s) => s.ds)
  const subset = useSceneStore((s) => s.subset)
  const model = useSceneStore((s) => s.model)
  const isTraining = useSceneStore((s) => s.isTraining)
  const setEvaluation = useSceneStore((s) => s.setEvaluation)
  const resetEvaluation = useSceneStore((s) => s.resetEvaluation)
  useEffect(() => () => resetEvaluation(), [ds, subset, resetEvaluation])
  useEffect(() => {
    if (!ds || !model || isTraining) return // evaluate after training, not during
    let cancelled = false
    getEvaluation(ds, model, subset)
      .then((evaluation) => {
        if (!cancelled) setEvaluation(evaluation)
      })
      .catch(console.warn)
    return () => {
      cancelled = true
    }
  }, [ds, subset, model, isTraining, setEvaluation])
}

export function useHasSample() {
  // to hide the ConfusionViewer when a sample is selected
  return useSceneStore((s) => typeof s.sampleIdx === "number")
}

function ConfusionViewer() {
  const hasSample = useHasSample()
  const setSampleIdx = useSceneStore((s) => s.setSampleIdx)
  const numClasses = useSceneStore((s) => s.ds?.outputLabels?.length ?? 0)
  return (
    <div className={`pointer-events-none pb-8`}>
      <div
        className={`pointer-events-auto ${
          hasSample
            ? "translate-x-[-66vw] xl:translate-x-[-50vw] scale-10 max-w-screen max-h-screen overflow-clip"
            : ""
        } transition-transform duration-500 mx-auto`}
        onClick={hasSample ? () => setSampleIdx(undefined) : undefined}
      >
        {numClasses <= 100 && <ConfusionMatrix />}
      </div>
      {!hasSample && (
        <div className="sticky left-0 w-screen p-main">
          <Evaluation className="my-4 max-w-125 mx-auto" />
        </div>
      )}
    </div>
  )
}

const LOSS_DICT = {
  meanSquaredError: "MSE",
  meanAbsoluteError: "MAE",
  categoricalCrossentropy: "CCE",
  sparseCategoricalCrossentropy: "SCCE",
} as Record<string, string>

function Evaluation({ className = "" }) {
  const ds = useSceneStore((s) => s.ds)
  const model = useSceneStore((s) => s.model)
  const subset = useSceneStore((s) => s.subset)
  const { loss, accuracy, rSquared, perplexity, topKAccuracy } = useSceneStore((s) => s.evaluation)

  const _lossName = typeof model?.loss === "string" ? model.loss : ""
  const lossName =
    _lossName && isScreen("sm")
      ? `(${_lossName})`
      : _lossName in LOSS_DICT
        ? `(${LOSS_DICT[_lossName]})`
        : ""

  const rmse =
    _lossName === "meanSquaredError" && typeof loss === "number" ? Math.sqrt(loss) : undefined

  return (
    <div className={`mt-4 pointer-events-auto select-text ${className}`}>
      <Table
        data={{
          Samples: ds?.[subset].totalSamples,
          [`Loss ${lossName}`]: loss?.toFixed(3),
          [`Loss (RMSE)`]: rmse?.toFixed(3),
          Perplexity: perplexity?.toFixed(1), // nextToken
          Accuracy: accuracy?.toFixed(3),
          "Top-5 accuracy": topKAccuracy?.toFixed(3), // nextToken
          "R²": rSquared?.toFixed(3),
        }}
      />
    </div>
  )
}
