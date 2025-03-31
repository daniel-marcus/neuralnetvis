import { useMemo, useCallback, useEffect, useRef, useState } from "react"
import { InlineButton, Table } from "@/components/ui-elements"
import { useCurrScene } from "@/store"
import type { ReactNode, Ref, RefObject } from "react"

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

export function LogsPlot({ className = "" }) {
  const [logs, currMetrics] = useLogs()
  const logsMetric = useCurrScene((s) => s.logsMetric)
  const [canvasRef, positions] = useCanvasUpdate(logs, logsMetric)
  const [handlers, dot, tooltip] = useTooltip(logs, positions, canvasRef)
  return (
    <div className={className}>
      <div className="relative h-[100px] sm:h-[132px]">
        <canvas ref={canvasRef} className={`w-full h-full`} {...handlers} />
        {dot}
        {tooltip}
      </div>
      <Metrics currMetrics={currMetrics} />
    </div>
  )
}

function useLogs() {
  const batchLogs = useCurrScene((s) => s.batchLogs)
  const epochLogs = useCurrScene((s) => s.epochLogs)
  const logsMetric = useCurrScene((s) => s.logsMetric)
  const isValMetric = VAL_METRICS.includes(logsMetric)

  const logs = useMemo(() => {
    const hasMoreEpochLogs = epochLogs.length >= batchLogs.length
    return isValMetric || hasMoreEpochLogs ? epochLogs : batchLogs
  }, [batchLogs, epochLogs, isValMetric])

  const currMetrics = useMemo(
    () => new Set([...batchLogs, ...epochLogs].flatMap(Object.keys)),
    [batchLogs, epochLogs]
  )
  return [logs, currMetrics] as const
}

type MouseXY = { x: number; y: number }

function useMousePos() {
  const [mouseXY, setMouseXY] = useState<MouseXY | null>(null)

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setMouseXY({ x, y })
  }, [])

  const handlers = {
    onMouseEnter: onMouseMove,
    onMouseMove,
    onMouseLeave: () => setMouseXY(null),
  }

  return [mouseXY, handlers] as const
}

type TooltipText = React.ReactNode | null

const TOOLTIP_WIDTH = 132
const TOOLTIP_HEIGHT = 80

function useTooltip(
  logs: TrainingLog[],
  positions: RefObject<[number, number][]>,
  canvasRef: RefObject<HTMLCanvasElement | null>
) {
  const [mouseXY, handlers] = useMousePos()
  const tooltipRef = useRef<HTMLDivElement>(null)
  const dotRef = useRef<HTMLDivElement>(null)
  const [tooltipText, setTooltipText] = useState<TooltipText | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const rect = canvas?.getBoundingClientRect()
    if (!canvas || !rect || !mouseXY || !tooltipRef.current) {
      setTooltipText(null)
      return
    }
    const { x, y } = mouseXY
    const i = Math.floor((x / rect.width) * logs.length)

    const tooltipX = clamp(x, TOOLTIP_WIDTH / 2, rect.width - TOOLTIP_WIDTH / 2)
    const tooltipY = Math.max(y, rect.height - TOOLTIP_HEIGHT) - 10
    updElPos(tooltipRef.current, tooltipX, tooltipY)

    const point = positions.current[i]
    if (dotRef.current && point) {
      const dotX = (point[0] / canvas.width) * rect.width
      const dotY = (point[1] / canvas.height) * rect.height
      updElPos(dotRef.current, dotX, dotY)
    }

    const log = logs[i]
    if (!log) return
    const ep = log.epoch + 1
    const t = isBatchLog(log) ? `Batch ${ep}.${log.batch + 1}` : `Epoch ${ep}`
    const getVal = (val?: number) => val?.toPrecision(3)
    const data = Object.fromEntries(METRICS.map((m) => [m, getVal(log[m])]))
    setTooltipText(<Table title={<strong>{t}</strong>} data={data} />)
  }, [mouseXY, logs, positions, canvasRef, tooltipRef])

  const dot = !!tooltipText && <Dot ref={dotRef} />
  const tooltip = <Tooltip ref={tooltipRef}>{tooltipText}</Tooltip>

  return [handlers, dot, tooltip] as const
}

function updElPos(el: HTMLElement, x: number, y: number) {
  el.style.left = `${x}px`
  el.style.top = `${y}px`
}

const clamp = (val: number, min: number, max: number) =>
  Math.max(min, Math.min(val, max))

function Metrics({ currMetrics }: { currMetrics: Set<string> }) {
  const logsMetric = useCurrScene((s) => s.logsMetric)
  const setLogsMetric = useCurrScene((s) => s.setLogsMetric)
  const validationSplit = useCurrScene((s) => s.trainConfig.validationSplit)
  return (
    <div className={`flex mt-2 justify-end`}>
      {METRICS.filter((m) => currMetrics.has(m)).map((m) => {
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
  )
}

export function isBatchLog(log: TrainingLog): log is BatchLog {
  return "batch" in log && typeof log.batch === "number"
}

const Dot = ({ ref }: { ref: Ref<HTMLDivElement> }) => (
  <div
    ref={ref}
    className={`absolute p-0 w-2 h-2 transform -translate-x-1/2 -translate-y-1/2 rounded-full bg-white pointer-events-none`}
  />
)

type TooltipProps = { children?: ReactNode; ref?: Ref<HTMLDivElement> }

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

function useCanvasUpdate(logs: TrainingLog[], metric: Metric) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const positions = useRef<[number, number][]>([])
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    function onResize() {
      const rect = canvasRef.current?.parentElement?.getBoundingClientRect()
      if (!rect) return
      const dpr = window.devicePixelRatio || 1
      setSize({ width: rect.width * dpr, height: rect.height * dpr })
    }
    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])
  useEffect(() => {
    if (!Array.isArray(logs)) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    const { width, height } = size
    canvas.width = width
    canvas.height = height

    ctx.clearRect(0, 0, width, height)
    positions.current = []

    const allVals = logs
      .filter((log) => typeof log[metric] === "number")
      .map((log) => log[metric]!)
    const max = Math.max(...allVals)
    const min = Math.min(...allVals)
    const getX = (i: number) => (i / (logs.length - 1)) * width
    const getY = (val: number) => height - ((val - min) / (max - min)) * height

    // draw epoch separators
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

    // draw loss line
    ctx.beginPath()
    ctx.strokeStyle = "white"
    ctx.lineWidth = 1.5
    logs.forEach((log, i) => {
      const value = log[metric]
      if (typeof value !== "number") return
      const x = getX(i)
      const y = getY(value)
      positions.current.push([x, y])
      if (i === 0) ctx.moveTo(x, y) // Move to the first point
      else ctx.lineTo(x, y) // Draw line to the next point
    })
    ctx.stroke()
  }, [logs, metric, size])
  return [canvasRef, positions] as const
}
