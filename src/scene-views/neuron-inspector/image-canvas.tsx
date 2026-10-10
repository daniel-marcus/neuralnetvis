import { useEffect, useRef } from "react"
import type { ReceptiveField } from "@/model/feature-vis"

interface ImageCanvasProps {
  data: ArrayLike<number>
  shape: number[] // [height, width, channels]
  maxValue?: number // 255 for raw pixels
  crop?: ReceptiveField
  className?: string
}

// draws grayscale / RGB values 1:1 to a canvas (scaled by CSS), optionally only a part of the image
export const ImageCanvas = ({
  data,
  shape,
  maxValue = 1,
  crop,
  className = "",
}: ImageCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [height, width, channels] = shape
  const {
    y: cropY = 0,
    x: cropX = 0,
    height: cropHeight = height,
    width: cropWidth = width,
  } = crop ?? {}
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    canvas.width = cropWidth
    canvas.height = cropHeight
    const imageData = ctx.createImageData(cropWidth, cropHeight)
    const scale = 255 / maxValue
    for (let y = 0; y < cropHeight; y++) {
      for (let x = 0; x < cropWidth; x++) {
        const src = ((cropY + y) * width + cropX + x) * channels
        const dst = (y * cropWidth + x) * 4
        for (let c = 0; c < 3; c++) {
          imageData.data[dst + c] = data[src + (channels === 1 ? 0 : c)] * scale
        }
        imageData.data[dst + 3] = 255
      }
    }
    ctx.putImageData(imageData, 0, 0)
  }, [data, width, channels, maxValue, cropY, cropX, cropHeight, cropWidth])
  return <canvas ref={canvasRef} className={`[image-rendering:pixelated] ${className}`} />
}
