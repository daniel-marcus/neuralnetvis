import React, { useState } from "react"
import { getScene, useCurrScene, useGlobalStore } from "@/store"
import * as Components from "@/components/ui-elements"
import { canUseLazyLoading } from "@/model/training"
import { LogsPlot } from "@/components/ui-elements/logs-plot"
import { canTrainLora, isLoraDs, MAX_LORA_BATCH_SIZE } from "@/model/lora/training"

const { Box, Slider, InputRow, InputRowsWrapper, Checkbox } = Components
const { Collapsible, CollapsibleWithTitle, Arrow, Button } = Components

export const Train = () => {
  const isTraining = useCurrScene((s) => s.isTraining)
  const toggleTraining = useCurrScene((s) => s.toggleTraining)

  const [logsExpanded, setLogsExpanded] = useState(true)
  const hasLogs = useCurrScene((s) => s.epochLogs.length + s.batchLogs.length > 0)
  const showLogs = logsExpanded && hasLogs
  const resetWeights = useCurrScene((s) => s.resetWeights)
  const batchCount = useCurrScene((s) => s.batchCount)
  const hasTestData = useCurrScene((s) => !!s.ds?.test?.totalSamples)
  const view = useCurrScene((s) => s.view)
  const setView = useCurrScene((s) => s.setView)
  const toggleTab = useGlobalStore((s) => s.toggleTab)
  const isLora = useCurrScene((s) => isLoraDs(s.ds))
  const hasLora = useCurrScene((s) => !!s.lora)
  const loraEnabled = useCurrScene((s) => s.lora?.adapter.enabled ?? false)
  const hasSamples = useCurrScene((s) => !!s.ds?.train.totalSamples)
  const loraHint = !isLora
    ? undefined
    : !canTrainLora()
      ? "Fine-tuning (LoRA) needs WebGPU."
      : !hasSamples
        ? 'Save texts in the input area ("save") to fine-tune the model on them.'
        : undefined
  return (
    <Box>
      <TrainConfigControl />
      {!!loraHint && <div className="px-4 pt-4 text-sm opacity-75">{loraHint}</div>}
      <Collapsible isOpen={showLogs}>{hasLogs && <LogsPlot className="px-4 pt-4" />}</Collapsible>
      <div className="p-4 flex justify-between">
        <button
          className={`${hasLogs ? "" : "opacity-0 pointer-events-none"}`}
          onClick={() => setLogsExpanded((s) => !s)}
        >
          <Arrow direction={showLogs ? "up" : "right"} />
          logs
        </button>
        <div className="flex gap-2">
          {hasLora && !isTraining && (
            <Button variant="secondary" onClick={toggleLora}>
              {loraEnabled ? "show base" : "show fine-tuned"}
            </Button>
          )}
          {!!batchCount && !(isLora && isTraining) && (
            <Button variant="secondary" onClick={isLora ? resetLora : resetWeights}>
              reset
            </Button>
          )}
          {hasTestData && view !== "evaluation" && (
            <Button
              variant="secondary"
              onClick={() => {
                toggleTab("train")
                setView("evaluation")
              }}
            >
              evaluate
            </Button>
          )}
          <Button onClick={toggleTraining} disabled={!isTraining && !!loraHint}>
            {isTraining ? "stop" : "train"}
          </Button>
        </div>
      </div>
    </Box>
  )
}

// LoRA: compare the fine-tuned with the base model
function toggleLora() {
  const { lora, bumpAdapterVersion } = getScene().getState()
  lora?.adapter.setEnabled(!lora.adapter.enabled)
  bumpAdapterVersion()
}

function resetLora() {
  const { setLora, resetTrainCounts } = getScene().getState()
  setLora(undefined) // disposed in useLora
  resetTrainCounts()
}

const TrainConfigControl = () => {
  const config = useCurrScene((s) => s.trainConfig)
  const setConfig = useCurrScene((s) => s.setTrainConfig)
  const ds = useCurrScene((s) => s.ds)
  const isLora = isLoraDs(ds)

  return (
    <CollapsibleWithTitle title="config" className="bg-box-solid">
      <InputRowsWrapper
        style={
          {
            "--slider-value-width": "4em",
          } as React.CSSProperties
        }
      >
        <InputRow label="batchSize" hint="How many samples should be processed at once?">
          <Slider
            // value={config.batchSize}
            value={Math.log2(config.batchSize)}
            min={0} // 2^0 = 1
            max={isLora ? Math.log2(MAX_LORA_BATCH_SIZE) : 10} // 2^10 = 1024
            transform={(v) => 2 ** v}
            onChange={(batchSize) => setConfig({ batchSize })}
            showValue={true}
            lazyUpdate
          />
        </InputRow>
        <InputRow label="epochs" hint={"How often should the model see the entire dataset?"}>
          <Slider
            value={config.epochs}
            min={1}
            max={100}
            onChange={(epochs) => setConfig({ epochs })}
            showValue={true}
            lazyUpdate
          />
        </InputRow>
        <InputRow label="validSplit" hint="How much of the data should be used for validation?">
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
        <InputRow label="learningRate" hint="How fast should the model learn?">
          <Slider
            value={Math.log10(config.learningRate)}
            min={-4}
            max={-1}
            step={1}
            transform={(v) => 10 ** v}
            onChange={(learningRate) => setConfig({ learningRate })}
            showValue={true}
            lazyUpdate
          />
        </InputRow>
        {!isLora && (
          <InputRow label="silent" hint="Update visualization only after training (faster)">
            <Checkbox
              checked={config.silent}
              onChange={(silent) => setConfig({ silent: silent })}
            />
          </InputRow>
        )}
        {!!ds && !isLora && canUseLazyLoading(ds) && (
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
      </InputRowsWrapper>
    </CollapsibleWithTitle>
  )
}
