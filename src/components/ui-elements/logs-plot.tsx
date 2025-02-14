import { useMemo, useCallback, useEffect, useRef, useState, Ref } from "react"
import { InlineButton } from "./buttons"
import { useStore } from "@/store"

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

const BATCH_METRICS: (keyof TrainingLog)[] = ["loss", "acc"]
const EPOCH_METRICS: (keyof TrainingLog)[] = ["val_loss", "val_acc"]
const METRICS: (keyof TrainingLog)[] = [...BATCH_METRICS, ...EPOCH_METRICS]

export type Metric = (typeof METRICS)[number]

type TooltipContent = React.ReactNode | null

const TOOLTIP_WIDTH = 132
const TOOLTIP_HEIGHT = 80

export function LogsPlot({ isShown = true }: { isShown?: boolean }) {
  const logs = useStore((s) => s.logs)
  const logsMetric = useStore((s) => s.logsMetric)
  const setLogsMetric = useStore((s) => s.setLogsMetric)
  const isEpochMetric = EPOCH_METRICS.includes(logsMetric)
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
  const [canvasRef, positions] = useCanvasUpdate(filteredLogs, logsMetric)
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
  const validationSplit = useStore((s) => s.trainConfig.validationSplit)
  if (!logs.length) return null
  return (
    <div>
      {!!isShown && (
        <div>
          <div className="relative" onMouseLeave={() => setTooltip(null)}>
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
      <div className={`flex mt-2 justify-end ${isShown ? "" : "hidden"}`}>
        {METRICS.map((m) => {
          const isSelected = m === logsMetric
          const isDisabled = !validationSplit && EPOCH_METRICS.includes(m)
          return (
            <InlineButton
              key={m}
              variant="transparent"
              className={`${isSelected ? "text-white" : ""} ${
                isDisabled ? "opacity-50" : ""
              }`}
              onClick={() => setLogsMetric(m)}
              disabled={isDisabled}
            >
              {m}
            </InlineButton>
          )
        })}
      </div>
    </div>
  )
}

type DotProps = { hidden: boolean; ref: Ref<HTMLDivElement> }

const Dot = ({ hidden, ref }: DotProps) => (
  <div
    ref={ref}
    className={`absolute ${
      hidden ? "hidden" : ""
    } p-0 w-2 h-2 transform -translate-x-1/2 -translate-y-1/2 rounded-full bg-white pointer-events-none`}
  />
)

type TooltipProps = { children?: React.ReactNode; ref?: Ref<HTMLDivElement> }

const Tooltip = ({ children, ref }: TooltipProps) => (
  <div
    ref={ref}
    className={`${
      !children ? "hidden" : ""
    } absolute bg-black text-white text-xs px-2 py-1 rounded transform -translate-x-1/2 -translate-y-full pointer-events-none`}
    style={{ width: `${TOOLTIP_WIDTH}px` }}
  >
    {children}
  </div>
)

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
