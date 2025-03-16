import React, { useEffect, useState } from "react"
import { useCurrScene, useGlobalStore } from "@/store"
import * as Components from "@/components/ui-elements"
import { canUseLazyLoading, getModelEvaluation } from "@/model/training"

const { Box, InlineButton, Slider, InputRow, Checkbox } = Components
const { Collapsible, CollapsibleWithTitle, Arrow, LogsPlot } = Components

export const Train = () => {
  const isTraining = useCurrScene((s) => s.isTraining)
  const toggleTraining = useCurrScene((s) => s.toggleTraining)

  const [showLogs, setShowLogs] = useState(false)
  const hasLogs = useCurrScene((s) => s.logs.length > 0)
  useEffect(() => {
    if (hasLogs) setShowLogs(true)
  }, [hasLogs])
  const evaluate = useEvaluate()
  const resetWeights = useCurrScene((s) => s.resetWeights)
  const batchCount = useCurrScene((s) => s.batchCount)
  const hasTestData = useCurrScene((s) => !!s.ds?.test?.totalSamples)
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
          {!!batchCount && (
            <InlineButton variant="secondary" onClick={resetWeights}>
              reset
            </InlineButton>
          )}
          {hasTestData && !!batchCount && (
            <InlineButton variant="secondary" onClick={evaluate}>
              evaluate
            </InlineButton>
          )}
          <InlineButton onClick={toggleTraining}>
            {isTraining ? "stop" : "train"}
          </InlineButton>
        </div>
      </div>
    </Box>
  )
}

const TrainConfigControl = () => {
  const config = useCurrScene((s) => s.trainConfig)
  const setConfig = useCurrScene((s) => s.setTrainConfig)
  const ds = useCurrScene((s) => s.ds)

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
          lazyUpdate
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
          lazyUpdate
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
          lazyUpdate
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

      {!!ds && canUseLazyLoading(ds) && (
        <InputRow
          label="lazyLoading"
          hint="Load data on the fly (could be slower, but saves memory)"
        >
          <Checkbox
            checked={config.lazyLoading}
            onChange={(lazyLoading) => setConfig({ lazyLoading })}
          />
        </InputRow>
      )}
    </CollapsibleWithTitle>
  )
}

function useEvaluate() {
  const ds = useCurrScene((s) => s.ds)
  const setStatus = useGlobalStore((s) => s.status.update)
  async function evaluate() {
    if (!ds) return
    const { loss, accuracy } = await getModelEvaluation()
    const data = {
      "Test samples": ds.test.totalSamples,
      Loss: loss?.toFixed(3),
      Accuracy: accuracy?.toFixed(3),
    }
    setStatus({ data }, null)
  }
  return evaluate
}
