import { useCallback, useEffect } from "react"
import * as tf from "@tensorflow/tfjs"
import { useSceneStore, useGlobalStore } from "@/store"
import { centerCropResize } from "./utils"

export interface RecorderProps {
  stream?: MediaStream
}

export type CaptureFunc = (
  video: HTMLVideoElement
) => Promise<number[] | undefined>

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

async function videoToSample(video: HTMLVideoElement, inputDims?: number[]) {
  if (!inputDims || !video.videoWidth || !video.videoHeight) return
  const [height, width, channels] = inputDims
  const tensor = await tf.browser.fromPixelsAsync(video, channels)
  const resized = tf.tidy(() =>
    centerCropResize(tensor, height, width).flatten()
  )
  let data: number[] | undefined
  try {
    data = await resized.array()
  } finally {
    tf.dispose([tensor, resized])
  }
  return data
}
