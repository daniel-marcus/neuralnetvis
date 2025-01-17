import {
  createPlugin,
  Components,
  useInputContext,
  LevaInputProps,
} from "leva/plugin"
import { useEffect, useRef } from "react"

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

function LossPlot() {
  const { value: lossHistory, label } = useInputContext<LossPlotProps>()
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
  return (
    <Row>
      <Label>{label}</Label>
      <canvas ref={canvasRef} className={`w-full h-[80px]`} />
    </Row>
  )
}
