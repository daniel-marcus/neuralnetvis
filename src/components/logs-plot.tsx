import {
  createPlugin,
  Components,
  useInputContext,
  LevaInputProps,
} from "leva/plugin"
import {
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useState,
  forwardRef,
} from "react"

// careful with circular imports!

// reference: https://github.com/pmndrs/leva/blob/main/packages/plugin-plot/src/PlotCanvas.tsx

const { Row } = Components

export type TrainingLog = {
  epoch?: number
  batch?: number
  size?: number
  loss?: number
  acc?: number
  val_loss?: number // for epoch only
  val_acc?: number // for epoch only
}

type LossPlotProps = LevaInputProps<TrainingLog[]>

export const logsPlot = createPlugin({
  component: LogsPlot,
  normalize: (input?: { value?: TrainingLog[] }) => {
    return { value: input?.value ?? ([] as TrainingLog[]) }
  },
})

type TooltipContent = React.ReactNode | null

const TOOLTIP_WIDTH = 120

const BATCH_METRICS: (keyof TrainingLog)[] = ["loss", "acc"]
const EPOCH_METRICS: (keyof TrainingLog)[] = ["val_loss", "val_acc"]
const METRICS: (keyof TrainingLog)[] = [...BATCH_METRICS, ...EPOCH_METRICS]

function LogsPlot() {
  const { value: logs } = useInputContext<LossPlotProps>()
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
      const tooltipY = Math.max(y, 0)
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
  return (
    <>
      <Row>
        <div className={`flex justify-center space-x-2`}>
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
      </Row>
      <Row>
        <div className="relative mt-2" onMouseLeave={() => setTooltip(null)}>
          <canvas
            ref={canvasRef}
            className={`w-full h-[80px]`}
            onMouseMove={onMouseMove}
          />
          <Dot ref={dotRef} hidden={!tooltip} />
          <Tooltip ref={tooltipRef}>{tooltip}</Tooltip>
        </div>
      </Row>
    </>
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
        } absolute w-[120px] bg-black text-white p-1 rounded transform -translate-x-1/2 -translate-y-full`}
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
        ctx.lineWidth = 0.5
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
    })

    // second: draw loss line
    ctx.beginPath()
    ctx.strokeStyle = "white"
    ctx.lineWidth = 2
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
