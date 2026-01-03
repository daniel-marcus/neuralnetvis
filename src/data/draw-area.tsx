import { useRef, useState, useEffect, useCallback } from "react"
import { useSceneStore } from "@/store"
import { imageToMnistSample } from "./my-sample"
import { Button } from "@/components/ui-elements"

export const DrawArea = ({ title = "Draw a digit" }) => {
  const ref = useRef<HTMLCanvasElement>(null)
  const toggleDrawAreaShown = useSceneStore((s) => s.toggleDrawAreaShown)
  const ds = useSceneStore((s) => s.ds)
  const setCustomSample = useSceneStore((s) => s.setCustomSample)
  const [isDrawing, setIsDrawing] = useState(false)

  const getEventCoordinates = (e: TouchEvent | React.MouseEvent) => {
    if ("touches" in e && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    return {
      x: (e as React.MouseEvent).clientX,
      y: (e as React.MouseEvent).clientY,
    }
  }

  const handleMouseDown = useCallback((e: TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!ref.current) return

    const canvas = ref.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1

    if (canvas.width !== rect.width * dpr) {
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)
    }

    const { x: clientX, y: clientY } = getEventCoordinates(e)
    const x = clientX - rect.left
    const y = clientY - rect.top

    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }, [])

  const handleMouseMove = useCallback(
    async (e: TouchEvent | React.MouseEvent) => {
      if (!isDrawing || !ref.current) return

      const canvas = ref.current
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const rect = canvas.getBoundingClientRect()
      const { x: clientX, y: clientY } = getEventCoordinates(e)
      const x = clientX - rect.left
      const y = clientY - rect.top

      ctx.lineWidth = Math.round(rect.width / 15)
      ctx.lineCap = "round"
      ctx.strokeStyle = "white"
      ctx.lineTo(x, y)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x, y)

      if (!ds?.inputDims) return
      const sampleRaw = await imageToMnistSample(ref.current, ds.inputDims)
      if (sampleRaw) setCustomSample(sampleRaw)
    },
    [isDrawing, ds, setCustomSample],
  )

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false)
    ref.current?.getContext("2d")?.beginPath()
  }, [])

  const handleClear = () => {
    if (!ref.current) return
    const canvas = ref.current
    const ctx = canvas.getContext("2d")
    ctx?.clearRect(0, 0, canvas.width, canvas.height)
  }

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return

    // Add touch event listeners with { passive: false } to allow preventDefault
    canvas.addEventListener("touchstart", handleMouseDown, { passive: false })
    canvas.addEventListener("touchmove", handleMouseMove, { passive: false })
    canvas.addEventListener("touchend", handleMouseUp, { passive: false })

    return () => {
      canvas.removeEventListener("touchstart", handleMouseDown)
      canvas.removeEventListener("touchmove", handleMouseMove)
      canvas.removeEventListener("touchend", handleMouseUp)
    }
  }, [handleMouseDown, handleMouseMove, handleMouseUp])

  return (
    <div className="z-20 flex flex-col items-center gap-2 pointer-events-auto pt-8">
      <div>{title}</div>
      <canvas
        className="w-40 lg:w-75 aspect-square border rounded-2xl bg-box-dark"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseUp}
        ref={ref}
      />
      <div className="flex gap-2">
        <Button onClick={handleClear}>clear</Button>
        <Button onClick={toggleDrawAreaShown} variant="secondary">
          close
        </Button>
      </div>
    </div>
  )
}
