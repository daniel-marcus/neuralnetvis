import { LogsPlot, useLogStore } from "@/ui-components/logs-plot"
import {
  Box,
  InlineButton,
  Slider,
  InputRow,
  Checkbox,
  Collapsible,
  ControlPanel,
  Arrow,
} from "@/ui-components"
import { getModelEvaluation, useTrainingStore } from "@/tf/training"
import React, { useEffect, useState } from "react"
import { useDatasetStore } from "@/data/datasets"
import { useStatusText } from "@/components/status"

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
    <ControlPanel title="config">
      <InputRow label="batchSize">
        <Slider
          value={config.batchSize}
          min={1}
          max={512}
          onChange={(v) => setConfig({ batchSize: v })}
          showValue={true}
        />
      </InputRow>
      <InputRow label="epochs">
        <Slider
          value={config.epochs}
          min={1}
          max={100}
          onChange={(v) => setConfig({ epochs: v })}
          showValue={true}
        />
      </InputRow>
      <InputRow label="validSplit">
        <Slider
          value={config.validationSplit}
          min={0}
          max={0.5}
          step={0.1}
          onChange={(v) => setConfig({ validationSplit: v })}
          showValue={true}
        />
      </InputRow>
      <InputRow label="silent">
        <Checkbox
          checked={config.silent}
          onChange={(v) => setConfig({ silent: v })}
        />
      </InputRow>
    </ControlPanel>
  )
}

function useEvaluate() {
  const ds = useDatasetStore((s) => s.ds)
  const setStatusText = useStatusText((s) => s.setStatusText)
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
