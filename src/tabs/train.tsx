import { ControlPanel, useControlStores } from "@/components/controls"
import { LogsPlot, useLogStore } from "@/components/logs-plot"
import { Box, InlineButton } from "@/components/menu"
import { useTrainingStore } from "@/lib/training"
import { Arrow } from "./model"
import { useEffect, useState } from "react"

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
      <div className="p-4 flex justify-between">
        <button
          className={`${hasLogs ? "" : "opacity-0 pointer-events-none"}`}
          onClick={() => setShowLogs((s) => !s)}
        >
          <Arrow direction={showLogs ? "down" : "right"} />
          logs
        </button>
        <InlineButton onClick={toggleTraining}>
          {isTraining ? "Stop" : "Start"} training
        </InlineButton>
      </div>
      {showLogs && (
        <div className="p-4 pt-0">
          <LogsPlot />
        </div>
      )}
    </Box>
  )
}
