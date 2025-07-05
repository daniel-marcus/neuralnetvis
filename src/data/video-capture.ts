import { useCallback, useEffect } from "react"
import * as tf from "@tensorflow/tfjs"
import { useSceneStore, useGlobalStore } from "@/store"
import { centerCropResize } from "./utils"
import type { SampleRaw } from "./types"

export interface RecorderProps {
  stream?: MediaStream
}

// CaptureFunc: converts video input to raw data for a sample
export type CaptureFunc = (
  video: HTMLVideoElement
) => Promise<SampleRaw["X"] | undefined>

export function useCaptureLoop(
  stream: MediaStream | null | undefined,
  capture: CaptureFunc
) {
  const ds = useSceneStore((s) => s.ds)
  const setSample = useSceneStore((s) => s.setSample)
  const videoRef = useSceneStore((s) => s.videoRef)
  const recY = useSceneStore((s) => s.recordingY)
  useEffect(() => {
    if (!stream) return
    let animationFrame: number
    let isCapturing = false
    async function captureLoop() {
      const isTraning = useGlobalStore.getState().scene.getState().isTraining
      const videoReady = (videoRef.current?.readyState ?? 0) >= 2
      if (!isTraning && !isCapturing && videoReady) {
        isCapturing = true
        try {
          const X = await capture(videoRef.current!)
          const y = typeof recY.current === "number" ? recY.current : undefined
          if (X) setSample({ X, y, index: Date.now() }, true)
        } finally {
          isCapturing = false
        }
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

async function videoToSample(video: HTMLVideoElement, inputDims?: number[]) {
  if (!inputDims || !video.videoWidth || !video.videoHeight) return
  const [height, width, channels] = inputDims
  let input: HTMLVideoElement | HTMLCanvasElement | ImageBitmap = video
  const needsResize = video.videoWidth !== width || video.videoHeight !== height
  if (isSafari() && tf.getBackend() === "webgpu") {
    input = await createImageBitmap(video, { premultiplyAlpha: "none" })
  }
  const imgTensor = await tf.browser.fromPixelsAsync(input, channels)
  const flattened = tf.tidy(() =>
    needsResize
      ? centerCropResize(imgTensor, height, width).flatten()
      : imgTensor.flatten()
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
