import { ControlPanel, useControlStores } from "@/components/controls"
import { LogsPlot, useLogStore } from "@/components/logs-plot"
import { Box, InlineButton } from "@/components/menu"
import { useTrainingStore } from "@/lib/training"
import { Arrow } from "./model"
import React, { useEffect, useState } from "react"

export const Train = () => {
  const trainConfigStore = useControlStores().trainConfigStore
  const isTraining = useTrainingStore((s) => s.isTraining)
  const toggleTraining = useTrainingStore((s) => s.toggleTraining)
  const [showLogs, setShowLogs] = useState(false)
  const hasLogs = useLogStore((s) => s.hasLogs())
  useEffect(() => {
    if (hasLogs) setShowLogs(true)
  }, [hasLogs])
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
        <InlineButton onClick={toggleTraining}>
          {isTraining ? "Stop" : "Start"} training
        </InlineButton>
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
