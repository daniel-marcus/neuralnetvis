import {
  createPlugin,
  Components,
  useInputContext,
  LevaInputProps,
} from "leva/plugin"
import { useCallback, useEffect, useRef, useState, forwardRef } from "react"

// careful with circular imports!

const { Row, Label } = Components

export type TrainingLog = {
  epoch?: number
  batch?: number
  size?: number
  loss?: number
  acc?: number
}

type LossPlotProps = LevaInputProps<TrainingLog[]>

export const lossPlot = createPlugin({
  component: LossPlot,
  normalize: (input?: { value?: TrainingLog[] }) => {
    return { value: input?.value ?? ([] as TrainingLog[]) }
  },
})

type TooltipContent = React.ReactNode | null

const TOOLTIP_WIDTH = 88

function LossPlot() {
  const { value: logs, label } = useInputContext<LossPlotProps>()
  const canvasRef = useCanvasUpdate(logs)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
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
      if (cursorRef.current) {
        cursorRef.current.style.left = `${x}px`
      }
      const xVal = (x / rect.width) * logs.length
      const i = Math.floor(xVal)
      const log = logs[i]
      if (!log) return
      const { epoch, batch, loss, acc } = log
      const tt = (
        <div>
          {(typeof epoch !== "undefined" || typeof batch !== "undefined") && (
            <div>
              <strong>
                Batch {(epoch ?? 0) + 1}.{(batch ?? 0) + 1}
              </strong>
            </div>
          )}
          {typeof loss !== "undefined" && <div>Loss: {loss?.toFixed(4)}</div>}
          {typeof acc !== "undefined" && <div>Acc: {acc?.toFixed(4)}</div>}
        </div>
      )
      setTooltip(<div>{tt}</div>)
    },
    [logs, tooltipRef, cursorRef]
  )
  return (
    <Row>
      <Label>{label}</Label>
      <div className="relative" onMouseLeave={() => setTooltip(null)}>
        <CursorLine ref={cursorRef} hidden={!tooltip} />
        <canvas
          ref={canvasRef}
          className={`w-full h-[80px]`}
          onMouseMove={onMouseMove}
        />
        <Tooltip ref={tooltipRef}>{tooltip}</Tooltip>
      </div>
    </Row>
  )
}

const CursorLine = forwardRef<HTMLDivElement, { hidden: boolean }>(
  ({ hidden }, ref) => (
    <div
      ref={ref}
      className={`${
        hidden ? "hidden" : ""
      } absolute top-0 w-[1px] h-full bg-[rgba(0,123,255,0.5)] pointer-events-none`}
    />
  )
)
CursorLine.displayName = "CursorLine"

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
        } absolute w-[88px] bg-black text-white p-1 rounded transform -translate-x-1/2 -translate-y-full`}
      >
        {children}
      </div>
    )
  }
)
Tooltip.displayName = "Tooltip"

function useCanvasUpdate(logs: TrainingLog[]) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!Array.isArray(logs)) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const { width, height } = canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const logsWithLoss = logs.filter(hasLoss)

    const maxVal = Math.max(...logsWithLoss.map(({ loss }) => loss))
    const getX = (i: number) => (i / (logs.length - 1)) * width

    // first: draw epoch separators
    logs.forEach(({ epoch }, i, arr) => {
      const prevEpoch = arr[i - 1]?.epoch
      const newEpoch = typeof prevEpoch !== "undefined" && prevEpoch !== epoch
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
    logsWithLoss.forEach(({ loss }, i) => {
      const x = getX(i)
      const y = height - (loss / maxVal) * height
      if (i === 0) {
        ctx.moveTo(x, y) // Move to the first point
      } else {
        ctx.lineTo(x, y) // Draw line to the next point
      }
    })
    ctx.stroke()
  }, [logs])
  return canvasRef
}

function hasLoss(log: TrainingLog): log is { loss: number } {
  return typeof log.loss === "number"
}
