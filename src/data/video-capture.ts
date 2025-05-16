import { useCallback, useEffect } from "react"
import * as tf from "@tensorflow/tfjs"
import { useSceneStore, useGlobalStore } from "@/store"

export interface RecorderProps {
  stream?: MediaStream
}

export type PredictFunc = (
  video: HTMLVideoElement
) => Promise<number[] | undefined>

export function useCaptureLoop(
  stream: MediaStream | null | undefined,
  predict: PredictFunc // a function that converts video input to raw data for a sample
) {
  const ds = useSceneStore((s) => s.ds)
  const setSample = useSceneStore((s) => s.setSample)
  // const nextSample = useSceneStore((s) => s.nextSample)
  const videoRef = useSceneStore((s) => s.videoRef)
  const recY = useSceneStore((s) => s.recordingY)
  useEffect(() => {
    if (!stream) return
    let animationFrame: number
    async function captureLoop() {
      const isTraning = useGlobalStore.getState().scene.getState().isTraining
      if (!isTraning && videoRef.current) {
        const X = await predict(videoRef.current)
        const y = typeof recY.current === "number" ? recY.current : undefined
        if (X) setSample({ X, y, index: Date.now() })
      }
      animationFrame = requestAnimationFrame(captureLoop)
    }
    captureLoop()
    return () => {
      cancelAnimationFrame(animationFrame)
      // nextSample()
    }
  }, [stream, videoRef, predict, ds, setSample, recY])
}

export function DefaultRecorder({ stream }: RecorderProps) {
  const inputDims = useSceneStore((s) => s.ds?.inputDims)
  const predict = useCallback(
    (v: HTMLVideoElement) => videoToSample(v, inputDims),
    [inputDims]
  )
  useCaptureLoop(stream, predict)
  return null
}

async function videoToSample(video: HTMLVideoElement, inputDims?: number[]) {
  if (!inputDims) return
  if (!video.videoWidth || !video.videoHeight) return
  const numChannels = inputDims[2]
  const tensor = await tf.browser.fromPixelsAsync(video, numChannels)
  const flattened = tf.tidy(() => {
    const resized = tf.image.resizeBilinear(tensor, [
      inputDims[0],
      inputDims[1],
    ])
    return resized.flatten()
  })
  let data: number[] | undefined
  try {
    data = await flattened.array()
  } finally {
    flattened.dispose()
  }
  return data
}
