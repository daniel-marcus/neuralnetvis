import { LogsPlot, useLogStore } from "@/components/ui-elements/logs-plot"
import {
  Box,
  InlineButton,
  Slider,
  InputRow,
  Checkbox,
  Collapsible,
  CollapsibleWithTitle,
  Arrow,
} from "@/components/ui-elements"
import { getModelEvaluation, useTrainingStore } from "@/model/training"
import React, { useEffect, useState } from "react"
import { useDatasetStore } from "@/data/data"
import { useStatusStore } from "@/components/status"

export const Train = () => {
  const isTraining = useTrainingStore((s) => s.isTraining)
  const toggleTraining = useTrainingStore((s) => s.toggleTraining)
  const [showLogs, setShowLogs] = useState(false)
  const hasLogs = useLogStore((s) => s.hasLogs())
  useEffect(() => {
    if (hasLogs) setShowLogs(true)
  }, [hasLogs])
  const evaluate = useEvaluate()
  return (
    <Box>
      <TrainConfigControl />
      <Collapsible isOpen={showLogs} maxHeight={184}>
        <div className="p-4 pb-0">
          <LogsPlot />
        </div>
      </Collapsible>
      <div className="p-4 flex justify-between">
        <button
          className={`${hasLogs ? "" : "opacity-0 pointer-events-none"}`}
          onClick={() => setShowLogs((s) => !s)}
        >
          <Arrow direction={showLogs ? "up" : "right"} />
          logs
        </button>
        <div className="flex gap-2">
          <InlineButton variant="secondary" onClick={evaluate}>
            evaluate
          </InlineButton>
          <InlineButton onClick={toggleTraining}>
            {isTraining ? "stop" : "train"}
          </InlineButton>
        </div>
      </div>
    </Box>
  )
}

const TrainConfigControl = () => {
  const config = useTrainingStore((s) => s.config)
  const setConfig = useTrainingStore((s) => s.setConfig)
  return (
    <CollapsibleWithTitle title="config">
      <InputRow
        label="batchSize"
        hint="How many samples should be processed at once?"
      >
        <Slider
          // value={config.batchSize}
          value={Math.log2(config.batchSize)}
          min={0} // 2^0 = 1
          max={10} // 2^10 = 1024
          transform={(v) => 2 ** v}
          onChange={(batchSize) => setConfig({ batchSize })}
          showValue={true}
        />
      </InputRow>
      <InputRow
        label="epochs"
        hint={"How often should the model see the entire dataset?"}
      >
        <Slider
          value={config.epochs}
          min={1}
          max={100}
          onChange={(epochs) => setConfig({ epochs })}
          showValue={true}
        />
      </InputRow>
      <InputRow
        label="validSplit"
        hint="How much of the data should be used for validation?"
      >
        <Slider
          value={config.validationSplit}
          min={0}
          max={0.5}
          step={0.1}
          onChange={(validationSplit) => setConfig({ validationSplit })}
          showValue={true}
        />
      </InputRow>
      <InputRow
        label="silent"
        hint="Update visualization only after training (faster)"
      >
        <Checkbox
          checked={config.silent}
          onChange={(silent) => setConfig({ silent: silent })}
        />
      </InputRow>

      <InputRow
        label="lazyLoading"
        hint="Load data on the fly (could be slower, but saves memory)"
      >
        <Checkbox
          checked={config.fitDataset}
          onChange={(fitDataset) => setConfig({ fitDataset })}
        />
      </InputRow>
    </CollapsibleWithTitle>
  )
}

function useEvaluate() {
  const ds = useDatasetStore((s) => s.ds)
  const setStatusText = useStatusStore((s) => s.setStatusText)
  async function evaluate() {
    if (!ds) return
    const { loss, accuracy } = await getModelEvaluation()
    const data = {
      "Test samples": ds.test.shapeX[0],
      Loss: loss?.toFixed(3),
      Accuracy: accuracy?.toFixed(3),
    }
    setStatusText({ data }, null)
  }
  return evaluate
}
