import { createPlugin, Components, useInputContext } from "leva/plugin"
import { useEffect, useRef } from "react"

const { Row, Label } = Components

interface LossPlotProps {
  label?: string
  __customInput: number[]
}

export const lossPlot = createPlugin({
  component: LossPlot,
})

function LossPlot() {
  const { value, label } = useInputContext<LossPlotProps>()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!Array.isArray(value)) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")

    if (!ctx) return
    const { width, height } = canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = "white"
    ctx.lineWidth = 2 // Line width
    ctx.beginPath()

    // Plot the points and connect them with lines
    value.forEach((v, i) => {
      const x = (i / (value.length - 1)) * width // Scale X based on array length
      const y = height - (v / Math.max(...value)) * height // Scale Y based on the max value

      if (i === 0) {
        ctx.moveTo(x, y) // Move to the first point
      } else {
        ctx.lineTo(x, y) // Draw line to the next point
      }
    })
    ctx.stroke()
  }, [value])
  // const hidden = !Array.isArray(value) || !value?.length
  return (
    <Row>
      <Label>{label}</Label>
      <canvas ref={canvasRef} className={`w-full h-[80px]`} />
    </Row>
  )
}
