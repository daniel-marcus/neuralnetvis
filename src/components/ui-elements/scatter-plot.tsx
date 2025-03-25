import { useRef, useEffect } from "react"

interface ScatterPlotProps {
  data: { x: number; y: number }[]
}

export function ScatterPlot({ data }: ScatterPlotProps) {
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
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"
    ctx.lineWidth = 0.3
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
    ctx.strokeStyle = "rgba(255,20,100, 1)"
    ctx.lineWidth = 2
    ctx.setLineDash([5, 3])
    ctx.beginPath()
    ctx.moveTo(scaleX(xMin), scaleY(xMin))
    ctx.lineTo(scaleX(xMax), scaleY(xMax))
    ctx.stroke()
  }, [data])
  return (
    <div ref={wrapperRef} className="w-[220px] h-[220px] mt-4 mx-auto">
      <canvas ref={canvasRef} className="aspect-square" />
    </div>
  )
}
