import { useRef, useEffect } from "react"

// deprecated: now using deck.gl

interface ScatterPlotProps {
  data: { x: number; y: number }[]
  xLegend?: string
  yLegend?: string
}

export function ScatterPlot({ data, xLegend, yLegend }: ScatterPlotProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!wrapperRef.current || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const { width, height } = wrapperRef.current.getBoundingClientRect()

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    // ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    const paddingX = 10
    const paddingY = 10
    const plotWidth = width - paddingX
    const plotHeight = height - paddingY * 2

    const xMin = Math.min(...data.map((d) => d.x))
    const xMax = Math.max(...data.map((d) => d.x))

    const scaleX = (x: number) => (x / xMax) * plotWidth
    const scaleY = (y: number) => (1 - y / xMax) * plotHeight + paddingY

    // axes
    ctx.strokeStyle = "rgb(140, 146, 164)"
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, height - paddingY)
    ctx.lineTo(width, height - paddingY)
    ctx.stroke()

    // data points
    const size = Math.max((plotWidth / data.length) * 0.75, 1.5)
    ctx.fillStyle = "rgb(200,255,90)"
    data.forEach(({ x, y }) => {
      ctx.beginPath()
      ctx.arc(scaleX(x), scaleY(y), size, 0, Math.PI * 2)
      ctx.fill()
    })

    // diagonal line
    ctx.strokeStyle = "rgb(255,20,100)"
    ctx.lineWidth = 2
    ctx.setLineDash([5, 3])
    ctx.beginPath()
    ctx.moveTo(scaleX(xMin), scaleY(xMin))
    ctx.lineTo(scaleX(xMax), scaleY(xMax))
    ctx.stroke()
  }, [data])
  return (
    <div
      ref={wrapperRef}
      className="relative w-[300px] h-[300px] md:w-[420px] md:h-[420px] aspect-square mt-4 mb-8 mx-auto"
    >
      <canvas ref={canvasRef} />
      {xLegend && (
        <div className="absolute bottom-[-1.25em] w-full text-center">
          {xLegend}
        </div>
      )}
      {yLegend && (
        <div className="absolute top-[calc(50%-1rem)] left-[-1.25em] -rotate-90 -translate-x-1/2 origin-center text-center">
          {yLegend}
        </div>
      )}
    </div>
  )
}
