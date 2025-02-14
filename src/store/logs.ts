import type { Metric, TrainingLog } from "@/components/ui-elements/logs-plot"
import { StateCreator } from "zustand"

export interface LogsSlice {
  logs: TrainingLog[]
  hasLogs: () => boolean
  resetLogs: () => void
  addLogs: (newLogs: TrainingLog[]) => void
  logsMetric: Metric
  setLogsMetric: (metric: Metric) => void
}

export const createLogsSlice: StateCreator<LogsSlice> = (set, get) => ({
  logs: [] as TrainingLog[],
  hasLogs: () => get().logs.length > 0,
  resetLogs: () => set({ logs: [] }),
  addLogs: (newLogs) => set(({ logs }) => ({ logs: [...logs, ...newLogs] })),
  logsMetric: "loss",
  setLogsMetric: (logsMetric) => set({ logsMetric }),
})
