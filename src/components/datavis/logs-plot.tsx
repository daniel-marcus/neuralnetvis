import { useMemo, useCallback, useEffect, useRef, useState, Ref } from "react"
import { InlineButton, Table } from "@/components/ui-elements"
import { useCurrScene } from "@/store"

// reference: https://github.com/pmndrs/leva/blob/main/packages/plugin-plot/src/PlotCanvas.tsx

interface EpochLog {
  epoch: number
  loss?: number
  acc?: number
  val_loss?: number
  val_acc?: number
}

interface BatchLog extends EpochLog {
  batch: number
  size: number
}

export type TrainingLog = BatchLog | EpochLog

const VAL_METRICS: (keyof EpochLog)[] = ["val_loss", "val_acc"]
const METRICS: (keyof TrainingLog)[] = ["loss", "acc", ...VAL_METRICS]

export type Metric = (typeof METRICS)[number]

type TooltipContent = React.ReactNode | null

const TOOLTIP_WIDTH = 132
const TOOLTIP_HEIGHT = 80

export function LogsPlot({ className = "" }) {
  const batchLogs = useCurrScene((s) => s.batchLogs)
  const epochLogs = useCurrScene((s) => s.epochLogs)
  const logsMetric = useCurrScene((s) => s.logsMetric)
  const setLogsMetric = useCurrScene((s) => s.setLogsMetric)
  const isValMetric = VAL_METRICS.includes(logsMetric)

  const logs = useMemo(() => {
    const hasMoreEpochLogs = epochLogs.length >= batchLogs.length
    return isValMetric || hasMoreEpochLogs ? epochLogs : batchLogs
  }, [batchLogs, epochLogs, isValMetric])

  const availableMetrics = useMemo(
    () => new Set([...batchLogs, ...epochLogs].flatMap(Object.keys)),
    [batchLogs, epochLogs]
  )
  const tooltipRef = useRef<HTMLDivElement>(null)
  const dotRef = useRef<HTMLDivElement>(null)
  const [canvasRef, positions] = useCanvasUpdate(logs, logsMetric)
  const [tooltip, setTooltip] = useState<TooltipContent | null>(null)
  const isRegression = useCurrScene((s) => s.isRegression())
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
      const i = Math.floor(xRel * logs.length)
      const log = logs[i]
      if (!log) return
      if (dotRef.current) {
        const point = positions.current[i]
        if (!point) return
        const dotX = (point[0] / canvas.width) * rect.width
        const dotY = (point[1] / canvas.height) * rect.height
        dotRef.current.style.left = `${dotX}px`
        dotRef.current.style.top = `${dotY}px`
      }
      const ep = log.epoch + 1
      const getVal = (val?: number) =>
        isRegression ? val?.toPrecision(3) : val?.toFixed(3)
      const tt = (
        <div>
          <div>
            <strong>
              {isBatchLog(log) ? `Batch ${ep}.${log.batch + 1}` : `Epoch ${ep}`}
            </strong>
          </div>
          <Table
            data={Object.fromEntries(METRICS.map((m) => [m, getVal(log[m])]))}
          />
        </div>
      )
      setTooltip(<div>{tt}</div>)
    },
    [logs, tooltipRef, positions, canvasRef, isRegression]
  )
  const validationSplit = useCurrScene((s) => s.trainConfig.validationSplit)
  return (
    <div className={className}>
      <div>
        <div
          className="relative h-[100px] sm:h-[132px]"
          onMouseLeave={() => setTooltip(null)}
        >
          <canvas
            ref={canvasRef}
            className={`w-full h-full`}
            onMouseMove={onMouseMove}
          />
          <Dot ref={dotRef} hidden={!tooltip} />
          <Tooltip ref={tooltipRef}>{tooltip}</Tooltip>
        </div>
      </div>
      <div className={`flex mt-2 justify-end`}>
        {METRICS.filter((m) => availableMetrics.has(m)).map((m) => {
          const isSelected = m === logsMetric
          const isDisabled = !validationSplit && VAL_METRICS.includes(m)
          return (
            <InlineButton
              key={m}
              variant="transparent"
              className={`${isSelected ? "text-white" : ""} ${
                isDisabled ? "opacity-50 hover:bg-transparent" : ""
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

export function isBatchLog(log: TrainingLog): log is BatchLog {
  return "batch" in log && typeof log.batch === "number"
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
    style={{ minWidth: `${TOOLTIP_WIDTH}px` }}
  >
    {children}
  </div>
)

function useCanvasUpdate(logs: TrainingLog[], metric: keyof TrainingLog) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const positions = useRef<[number, number][]>([])
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)
  useEffect(() => {
    function onResize() {
      const canvas = canvasRef.current
      const parent = canvas?.parentElement
      if (!canvas) return
      const rect = (parent ?? canvas).getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      setWidth(rect.width * dpr)
      setHeight(rect.height * dpr)
    }
    onResize()
    window.addEventListener("resize", onResize)
    return () => {
      window.removeEventListener("resize", onResize)
    }
  }, [])
  useEffect(() => {
    if (!Array.isArray(logs)) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const rect = (canvas.parentElement ?? canvas).getBoundingClientRect()
    canvas.width = width
    canvas.height = height
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    ctx.clearRect(0, 0, width, height)
    positions.current = []

    const allVals = logs
      .filter((log) => typeof log[metric] === "number")
      .map((log) => log[metric]!)
    const maxVal = Math.max(...allVals)
    const minVal = Math.min(...allVals)
    const scaleX = (i: number) => (i / (logs.length - 1)) * width
    const scaleY = (value: number) =>
      height - ((value - minVal) / (maxVal - minVal)) * height

    // first: draw epoch separators
    logs.forEach(({ epoch }, i, arr) => {
      const prevEpoch = arr[i - 1]?.epoch
      const newEpoch = prevEpoch !== epoch
      if (newEpoch) {
        const x = scaleX(i)
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
    ctx.lineWidth = 1.5
    logs.forEach((log, i) => {
      const value = log[metric]
      if (typeof value !== "number") return
      const x = scaleX(i)
      const y = scaleY(value)
      positions.current.push([x, y])
      if (i === 0) {
        ctx.moveTo(x, y) // Move to the first point
      } else {
        ctx.lineTo(x, y) // Draw line to the next point
      }
    })
    ctx.stroke()
  }, [logs, metric, width, height])
  return [canvasRef, positions] as const
}
