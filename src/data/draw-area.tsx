import * as tf from "@tensorflow/tfjs"
import { useRef, type PointerEvent } from "react"
import { useSceneStore } from "@/store"
import { Button } from "@/components/ui-elements"
import type { SampleRaw } from "./types"

export const DrawArea = ({ title = "Draw a digit" }) => {
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
    ctx.lineWidth = Math.round(rect.width / 15)
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
    imageToMnistSample(ref.current, ds!.inputDims).then(setCustomSample)
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

/**
 * Convert image or canvas with auto-padding and centering to MNIST-style sample.
 */
async function imageToMnistSample(
  image: HTMLImageElement | HTMLCanvasElement,
  inputDims?: number[],
): Promise<SampleRaw | undefined> {
  if (!inputDims || !image.width || !image.height) return
  const [targetHeight, targetWidth] = inputDims
  const numChannels = inputDims[2] || 1
  const imgTensor = tf.browser.fromPixels(image, numChannels)

  const [height, width] = imgTensor.shape
  const { rowSumsTensor, colSumsTensor } = tf.tidy(() => {
    const grayscale =
      numChannels === 1 ? imgTensor.squeeze() : imgTensor.mean(-1)
    const mask = grayscale.greater(10)
    return {
      rowSumsTensor: mask.sum(1),
      colSumsTensor: mask.sum(0),
    }
  })

  let rowSums: number[]
  let colSums: number[]
  try {
    rowSums = (await rowSumsTensor.array()) as number[]
    colSums = (await colSumsTensor.array()) as number[]
  } finally {
    rowSumsTensor.dispose()
    colSumsTensor.dispose()
  }

  const processed = tf.tidy(() => {
    let top = rowSums.findIndex((sum) => sum > 0)
    let bottom =
      rowSums.length - 1 - [...rowSums].reverse().findIndex((sum) => sum > 0)
    let left = colSums.findIndex((sum) => sum > 0)
    let right =
      colSums.length - 1 - [...colSums].reverse().findIndex((sum) => sum > 0)

    if (top === -1 || left === -1)
      [top, bottom, left, right] = [0, height - 1, 0, width - 1]

    const cropped = tf.slice(
      imgTensor,
      [top, left, 0],
      [bottom - top + 1, right - left + 1, numChannels],
    )
    const padded = tf.pad(
      cropped,
      [
        [50, 50],
        [50, 50],
        [0, 0],
      ],
      0,
    )
    const [h, w] = padded.shape
    const scale = Math.min(targetHeight / h, targetWidth / w)
    const [newH, newW] = [Math.round(h * scale), Math.round(w * scale)]
    const scaled = tf.image.resizeBilinear(padded, [newH, newW])
    const [pT, pL] = [
      Math.floor((targetHeight - newH) / 2),
      Math.floor((targetWidth - newW) / 2),
    ]
    return tf
      .pad(
        scaled,
        [
          [pT, targetHeight - newH - pT],
          [pL, targetWidth - newW - pL],
          [0, 0],
        ],
        0,
      )
      .flatten()
  })

  try {
    const X = (await processed.data()) as SampleRaw["X"]
    return { X, index: Date.now() }
  } finally {
    processed.dispose()
    imgTensor.dispose()
  }
}
