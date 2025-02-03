import { ControlPanel, useControlStores } from "@/components/controls"
import { LogsPlot, useLogStore } from "@/ui-components/logs-plot"
import { Box, InlineButton } from "@/ui-components"
import { getModelEvaluation, useTrainingStore } from "@/lib/training"
import { Arrow } from "./model"
import React, { useEffect, useState } from "react"
import { useModelStore } from "@/lib/model"
import { useDatasetStore } from "@/lib/datasets"
import { useStatusText } from "@/components/status"

export const Train = () => {
  const trainConfigStore = useControlStores().trainConfigStore
  const isTraining = useTrainingStore((s) => s.isTraining)
  const toggleTraining = useTrainingStore((s) => s.toggleTraining)
  const [showLogs, setShowLogs] = useState(false)
  const hasLogs = useLogStore((s) => s.hasLogs())
  useEffect(() => {
    if (hasLogs) setShowLogs(true)
  }, [hasLogs])
  const model = useModelStore((s) => s.model)
  const ds = useDatasetStore((s) => s.ds)
  const setStatusText = useStatusText((s) => s.setStatusText)
  async function evaluate() {
    if (!model || !ds) return
    const { loss, accuracy } = await getModelEvaluation(model, ds)
    const data = {
      Loss: loss?.toFixed(3),
      Accuracy: accuracy?.toFixed(3),
    }
    setStatusText(
      { title: "Model evaluation", data },
      { percent: null, time: 3 }
    )
  }
  return (
    <Box>
      <ControlPanel store={trainConfigStore} />
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
            {isTraining ? "stop" : "start"} training
          </InlineButton>
        </div>
      </div>
    </Box>
  )
}

interface CollapsibleProps {
  children?: React.ReactNode
  isOpen?: boolean
  maxHeight?: number
  animate?: boolean
}

export function Collapsible({
  children,
  isOpen = true,
  maxHeight = 300,
  animate = true,
}: CollapsibleProps) {
  return (
    <div
      className={`transition-height overflow-hidden ${
        isOpen ? "max-h-[var(--collapsible-max-h)]" : "max-h-0"
      } ${!animate ? "duration-0" : "duration-300"}`}
      style={
        {
          "--collapsible-max-h": `${maxHeight}px`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  )
}
