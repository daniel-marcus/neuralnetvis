import {
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useState,
  forwardRef,
} from "react"
import { create } from "zustand"

// reference: https://github.com/pmndrs/leva/blob/main/packages/plugin-plot/src/PlotCanvas.tsx

export type TrainingLog = {
  epoch?: number
  batch?: number
  size?: number
  loss?: number
  acc?: number
  val_loss?: number // for epoch only
  val_acc?: number // for epoch only
}

export type TrainingLogSetter = (
  arg: TrainingLog[] | ((prev: TrainingLog[]) => TrainingLog[])
) => void

interface LogsStore {
  logs: TrainingLog[]
  setLogs: TrainingLogSetter
  hasLogs: () => boolean
}

export const useLogStore = create<LogsStore>((set, get) => ({
  logs: [] as TrainingLog[],
  hasLogs: () => get().logs.length > 0,
  setLogs: (arg) =>
    set((state) => {
      const newVal = typeof arg === "function" ? arg(state.logs) : arg
      return { logs: newVal }
    }),
}))

type TooltipContent = React.ReactNode | null

const TOOLTIP_WIDTH = 132
const TOOLTIP_HEIGHT = 80

const BATCH_METRICS: (keyof TrainingLog)[] = ["loss", "acc"]
const EPOCH_METRICS: (keyof TrainingLog)[] = ["val_loss", "val_acc"]
const METRICS: (keyof TrainingLog)[] = [...BATCH_METRICS, ...EPOCH_METRICS]

export function LogsPlot({ isShown = true }: { isShown?: boolean }) {
  const logs = useLogStore((s) => s.logs)
  const [metric, setMetric] = useState<(typeof METRICS)[number]>("loss")
  const isEpochMetric = EPOCH_METRICS.includes(metric)
  const filteredLogs = useMemo(
    () =>
      logs.filter((log) =>
        isEpochMetric
          ? typeof log[EPOCH_METRICS[0]] !== "undefined"
          : typeof log[EPOCH_METRICS[0]] === "undefined"
      ),
    [logs, isEpochMetric]
  )
  const tooltipRef = useRef<HTMLDivElement>(null)
  const dotRef = useRef<HTMLDivElement>(null)
  const [canvasRef, positions] = useCanvasUpdate(filteredLogs, metric)
  const [tooltip, setTooltip] = useState<TooltipContent | null>(null)
  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      if (!tooltipRef.current) return
      // prevent overflow
      const tooltipX = Math.max(
        Math.min(x, rect.width - TOOLTIP_WIDTH / 2),
        TOOLTIP_WIDTH / 2
      )
      const tooltipY = Math.max(y, rect.height - TOOLTIP_HEIGHT)
      tooltipRef.current.style.left = `${tooltipX}px`
      tooltipRef.current.style.top = `${tooltipY - 10}px`
      const canvas = canvasRef.current
      if (!canvas) return
      const xRel = x / rect.width
      const i = Math.floor(xRel * filteredLogs.length)
      const log = filteredLogs[i]
      if (!log) return
      if (dotRef.current) {
        const point = positions.current[i]
        if (!point) return
        const dotX = (point[0] / canvas.width) * rect.width
        const dotY = (point[1] / canvas.height) * rect.height
        dotRef.current.style.left = `${dotX}px`
        dotRef.current.style.top = `${dotY}px`
      }
      const { epoch, batch } = log
      const epochNr = (epoch ?? 0) + 1
      const batchNr = (batch ?? 0) + 1
      const tt = (
        <div>
          <div>
            <strong>
              {isEpochMetric
                ? `Epoch ${epochNr}`
                : `Batch ${epochNr}.${batchNr}`}
            </strong>
          </div>
          {METRICS.filter((m) => typeof log[m] == "number").map((m) => (
            <div key={m}>
              {m}: {log[m]?.toFixed(4)}
            </div>
          ))}
        </div>
      )
      setTooltip(<div>{tt}</div>)
    },
    [filteredLogs, tooltipRef, isEpochMetric, positions, canvasRef]
  )
  if (!logs.length) return null
  return (
    <div>
      {!!isShown && (
        <div>
          <div className="relative mt-2" onMouseLeave={() => setTooltip(null)}>
            <canvas
              ref={canvasRef}
              className={`w-full h-[100px] sm:h-[132px]`}
              onMouseMove={onMouseMove}
            />
            <Dot ref={dotRef} hidden={!tooltip} />
            <Tooltip ref={tooltipRef}>{tooltip}</Tooltip>
          </div>
        </div>
      )}
      <div className={`flex justify-end ${isShown ? "" : "hidden"}`}>
        {METRICS.map((m) => {
          const isSelected = m === metric
          return (
            <button
              key={m}
              className={`${
                isSelected
                  ? "text-white"
                  : "hover:bg-[var(--leva-colors-elevation3)] "
              } rounded px-2 py-1`}
              onClick={() => setMetric(m)}
            >
              {m}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const Dot = forwardRef<HTMLDivElement, { hidden: boolean }>(
  ({ hidden }, ref) => (
    <div
      ref={ref}
      className={`absolute ${
        hidden ? "hidden" : ""
      } p-0 w-2 h-2 transform -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--leva-colors-highlight3)] pointer-events-none`}
    />
  )
)
Dot.displayName = "Dot"

interface TooltipProps {
  children?: React.ReactNode
}

const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(
  ({ children }, ref) => {
    const hidden = !children
    return (
      <div
        ref={ref}
        className={`${
          hidden ? "hidden" : ""
        } absolute bg-black text-white text-xs px-2 py-1 rounded transform -translate-x-1/2 -translate-y-full pointer-events-none`}
        style={{ width: `${TOOLTIP_WIDTH}px` }}
      >
        {children}
      </div>
    )
  }
)
Tooltip.displayName = "Tooltip"

function useCanvasUpdate(logs: TrainingLog[], metric: keyof TrainingLog) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const positions = useRef<[number, number][]>([])
  useEffect(() => {
    if (!Array.isArray(logs)) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const { width, height } = canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    positions.current = []

    const logsWithValue = logs.filter((log) => typeof log[metric] === "number")

    const maxVal = Math.max(
      ...logsWithValue.map((log) =>
        typeof log[metric] === "number" ? log[metric] : 0
      )
    )
    const getX = (i: number) => (i / (logs.length - 1)) * width

    // first: draw epoch separators
    logs.forEach(({ epoch }, i, arr) => {
      const prevEpoch = arr[i - 1]?.epoch
      const newEpoch = prevEpoch !== epoch
      if (newEpoch) {
        const x = getX(i)
        ctx.beginPath()
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"
        ctx.lineWidth = 0.3
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
    })

    // second: draw loss line
    ctx.beginPath()
    ctx.strokeStyle = "white"
    ctx.lineWidth = 1.5
    logs.forEach((log, i) => {
      const value = log[metric]
      if (typeof value !== "number") return
      const x = getX(i)
      const y = height - (value / maxVal) * height
      positions.current.push([x, y])
      if (i === 0) {
        ctx.moveTo(x, y) // Move to the first point
      } else {
        ctx.lineTo(x, y) // Draw line to the next point
      }
    })
    ctx.stroke()
  }, [logs, metric])
  return [canvasRef, positions] as const
}
