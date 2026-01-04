import * as tf from "@tensorflow/tfjs"
import { useRef, type PointerEvent } from "react"
import { useSceneStore } from "@/store"
import { Button } from "@/components/ui-elements"
import type { SampleRaw } from "./types"

export const DrawArea = ({ title = "" }) => {
  const ref = useRef<HTMLCanvasElement>(null)
  const toggleDrawAreaShown = useSceneStore((s) => s.toggleDrawAreaShown)
  const ds = useSceneStore((s) => s.ds)
  const setCustomSample = useSceneStore((s) => s.setCustomSample)
  const isDrawing = useRef(false)

  const getCtx = () => ref.current?.getContext("2d")
  const getCoords = (e: PointerEvent, rect: DOMRect) => ({
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  })
  const scaleCanvas = (canvas: HTMLCanvasElement, rect: DOMRect) => {
    const dpr = window.devicePixelRatio || 1
    if (canvas.width === rect.width * dpr) return
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.getContext("2d")?.scale(dpr, dpr)
  }

  const handlePointerDown = (e: PointerEvent) => {
    const ctx = getCtx()
    if (!ref.current || !ctx) return
    const rect = ref.current.getBoundingClientRect()
    scaleCanvas(ref.current, rect)
    ctx.lineWidth = Math.round(rect.width / 20)
    ctx.lineCap = "round"
    ctx.strokeStyle = "white"
    const { x, y } = getCoords(e, rect)
    ctx.beginPath()
    ctx.moveTo(x, y)
    isDrawing.current = true
  }

  const handlePointerMove = (e: PointerEvent) => {
    const ctx = getCtx()
    if (!isDrawing.current || !ref.current || !ctx) return
    const rect = ref.current.getBoundingClientRect()
    const { x, y } = getCoords(e, rect)
    ctx.lineTo(x, y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x, y)
    imageToMnistSample(ref.current, ds?.inputDims).then(setCustomSample)
  }

  const handlePointerUp = () => (isDrawing.current = false)

  const clear = () =>
    getCtx()?.clearRect(0, 0, ref.current!.width, ref.current!.height)

  return (
    <div className="z-20 flex flex-col items-center gap-2 pointer-events-auto pt-8">
      <div>{title}</div>
      <canvas
        ref={ref}
        className={`w-40 lg:w-75 aspect-square border-2 rounded-2xl bg-box-dark border-menu-border cursor-pencil touch-none`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <div className="flex gap-2">
        <Button onClick={clear}>clear</Button>
        <Button onClick={toggleDrawAreaShown} variant="secondary">
          close
        </Button>
      </div>
    </div>
  )
}

type ImgOrCanvas = HTMLImageElement | HTMLCanvasElement

/**
 * Convert image or canvas with auto-padding and centering to MNIST-style sample.
 */
async function imageToMnistSample(image: ImgOrCanvas, inputDims?: number[]) {
  if (!inputDims || !image.width || !image.height) return
  const [targetH, targetW, numChannels = 1] = inputDims
  const imgTensor = tf.browser.fromPixels(image, numChannels)
  const cropped = await getCroppedImage(imgTensor)

  const processed = tf.tidy(() => {
    const [h, w] = cropped.shape
    const pad = Math.round(Math.max(h, w) * 0.1) // 10 %
    const scale = Math.min(targetH / (h + 2 * pad), targetW / (w + 2 * pad))
    const [newH, newW] = [Math.round(h * scale), Math.round(w * scale)]
    const scaled = tf.image.resizeBilinear(cropped, [newH, newW])
    const pT = Math.floor((targetH - newH) / 2)
    const pL = Math.floor((targetW - newW) / 2)
    const yPadding = [pT, targetH - newH - pT] as [number, number]
    const xPadding = [pL, targetW - newW - pL] as [number, number]
    return scaled.pad([yPadding, xPadding, [0, 0]]).flatten()
  })

  try {
    const X = (await processed.data()) as SampleRaw["X"]
    return { X, index: Date.now() }
  } finally {
    tf.dispose([imgTensor, cropped, processed])
  }
}

/**
 * Crop image tensor to bounding box of non-empty content.
 */
async function getCroppedImage(imgTensor: tf.Tensor3D): Promise<tf.Tensor3D> {
  const numChannels = imgTensor.shape[2]
  const sums = tf.tidy(() => {
    const grayscale = imgTensor.mean(-1)
    const mask = grayscale.greater(0)
    return [mask.sum(1), mask.sum(0)]
  })
  const sumPromises = sums.map((t) => t.data())
  const [rowSums, colSums] = await Promise.all(sumPromises).finally(() => {
    tf.dispose(sums)
  })

  const top = rowSums.findIndex(Boolean)
  const bottom = rowSums.length - 1 - rowSums.toReversed().findIndex(Boolean)
  const left = colSums.findIndex(Boolean)
  const right = colSums.length - 1 - colSums.toReversed().findIndex(Boolean)

  if (top === -1 || left === -1) return imgTensor // empty image

  const size = [bottom - top + 1, right - left + 1, numChannels]
  return imgTensor.slice([top, left, 0], size)
}
