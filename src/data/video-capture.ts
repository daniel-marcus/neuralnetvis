import { useCallback, useEffect } from "react"
import * as tf from "@tensorflow/tfjs"
import { useSceneStore, useGlobalStore } from "@/store"
import type { SampleRaw } from "./types"

export interface RecorderProps {
  stream?: MediaStream
}

export type CaptureFunc = (
  video: HTMLVideoElement
) => Promise<SampleRaw["X"] | undefined>

export function useCaptureLoop(
  stream: MediaStream | null | undefined,
  capture: CaptureFunc // a function that converts video input to raw data for a sample
) {
  const ds = useSceneStore((s) => s.ds)
  const setSample = useSceneStore((s) => s.setSample)
  const videoRef = useSceneStore((s) => s.videoRef)
  const recY = useSceneStore((s) => s.recordingY)
  useEffect(() => {
    if (!stream) return
    let animationFrame: number
    async function captureLoop() {
      const isTraning = useGlobalStore.getState().scene.getState().isTraining
      if (!isTraning && videoRef.current) {
        const X = await capture(videoRef.current)
        const y = typeof recY.current === "number" ? recY.current : undefined
        if (X) setSample({ X, y, index: Date.now() }, true)
      }
      animationFrame = requestAnimationFrame(captureLoop)
    }
    captureLoop()
    return () => cancelAnimationFrame(animationFrame)
  }, [stream, videoRef, capture, ds, setSample, recY])
}

export function DefaultVideoCapture({ stream }: RecorderProps) {
  const inputDims = useSceneStore((s) => s.ds?.inputDims)
  const capture = useCallback(
    (v: HTMLVideoElement) => videoToSample(v, inputDims),
    [inputDims]
  )
  useCaptureLoop(stream, capture)
  return null
}

let videoCanvas: HTMLCanvasElement | undefined
function getVideoCanvas(height: number, width: number) {
  if (!videoCanvas) {
    videoCanvas = document.createElement("canvas")
    videoCanvas.width = width
    videoCanvas.height = height
  }
  if (videoCanvas.width !== width || videoCanvas.height !== height) {
    videoCanvas.width = width
    videoCanvas.height = height
  }
  return videoCanvas
}

async function videoToSample(video: HTMLVideoElement, inputDims?: number[]) {
  if (!inputDims || !video.videoWidth || !video.videoHeight) return
  const [height, width, channels] = inputDims
  let input: HTMLVideoElement | HTMLCanvasElement | ImageBitmap = video
  const needsResize = video.videoWidth !== width || video.videoHeight !== height
  if (needsResize) {
    const canvas = getVideoCanvas(height, width)
    canvas.getContext("2d")?.drawImage(video, 0, 0, width, height)
    input = canvas
  } else if (isSafari() && tf.getBackend() === "webgpu") {
    input = await createImageBitmap(video, { premultiplyAlpha: "none" })
  }
  const imgTensor = await tf.browser.fromPixelsAsync(input, channels)
  const flattened = tf.tidy(
    () => imgTensor.flatten() // assume correctly sized input with ds.camProps.videoConstraints
    // centerCropResize(tensor, height, width).flatten()
  )
  let data: Float32Array | undefined
  try {
    data = (await flattened.data()) as Float32Array
  } finally {
    tf.dispose([imgTensor, flattened])
  }
  return data
}

function isSafari() {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
}
