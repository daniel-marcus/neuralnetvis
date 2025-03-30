import { getModelEvaluation, getPredictions } from "@/model/training"
import { useSceneStore } from "@/store"
import { useEffect, useState } from "react"
import { Table } from "./ui-elements"
import { isScreen } from "@/utils/screen"

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
