import {
  createPlugin,
  Components,
  useInputContext,
  LevaInputProps,
} from "leva/plugin"
import { useCallback, useEffect, useRef, useState, forwardRef } from "react"

// careful with circular imports!

const { Row, Label } = Components

export const EPOCH_DIVIDER = "|"
export type LossHistory = (number | typeof EPOCH_DIVIDER)[]
type LossPlotProps = LevaInputProps<LossHistory>

export const lossPlot = createPlugin({
  component: LossPlot,
  normalize: (input?: { value?: LossHistory }) => {
    return { value: input?.value ?? ([] as LossHistory) }
  },
})

type TooltipContent = React.ReactNode | null

function LossPlot() {
  const { value: lossHistory, label } = useInputContext<LossPlotProps>()
  const canvasRef = useCanvasUpdate(lossHistory)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<TooltipContent | null>(null)
  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      if (!tooltipRef.current) {
        console.log("no tooltip ref")
        return
      }
      tooltipRef.current.style.left = `${x}px`
      tooltipRef.current.style.top = `${y - 5}px`
      const xVal = (x / rect.width) * lossHistory.length
      const i = Math.floor(xVal)
      const lossVal = lossHistory
        .filter((v) => typeof v === "number")
        [i]?.toFixed(4)
      setTooltip(<div>{lossVal}</div>)
    },
    [lossHistory, tooltipRef]
  )
  return (
    <Row>
      <Label>{label}</Label>
      <div className="relative" onMouseLeave={() => setTooltip(null)}>
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
        } absolute bg-black text-white p-1 rounded transform -translate-x-1/2 -translate-y-full`}
      >
        {children}
      </div>
    )
  }
)
Tooltip.displayName = "Tooltip"

function useCanvasUpdate(lossHistory: LossHistory) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!Array.isArray(lossHistory)) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const { width, height } = canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const lossHistoryWithEpochs = lossHistory.reduce((acc, v, i, arr) => {
      if (v === EPOCH_DIVIDER) return acc
      else if (arr[i - 1] === EPOCH_DIVIDER && i > 1) {
        acc.push({ value: v, newEpoch: true })
      } else {
        acc.push({ value: v })
      }
      return acc
    }, [] as { value: number; newEpoch?: boolean }[])
    const maxVal = Math.max(...lossHistoryWithEpochs.map(({ value }) => value))
    const getX = (i: number) => (i / (lossHistoryWithEpochs.length - 1)) * width

    // first: draw epoch separators
    lossHistoryWithEpochs.forEach(({ newEpoch }, i) => {
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
    lossHistoryWithEpochs.forEach(({ value }, i) => {
      const x = getX(i)
      const y = height - (value / maxVal) * height
      if (i === 0) {
        ctx.moveTo(x, y) // Move to the first point
      } else {
        ctx.lineTo(x, y) // Draw line to the next point
      }
    })
    ctx.stroke()
  }, [lossHistory])
  return canvasRef
}
