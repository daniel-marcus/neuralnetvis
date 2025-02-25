import { useCallback, useEffect, useRef, useState } from "react"
import * as tf from "@tensorflow/tfjs"
import { setStatus, useStore } from "@/store"
import { InlineButton } from "./ui-elements"
import {
  FilesetResolver,
  HandLandmarker,
  HandLandmarkerResult,
} from "@mediapipe/tasks-vision"
import { useKeyCommand } from "@/utils/key-command"

import * as draw from "@mediapipe/drawing_utils"
import * as hand from "@mediapipe/hands"
import { addTrainData } from "@/data/dataset"

const HAND_DIMS = [21, 3, 2]

export function VideoTest() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)

  async function toggleStream() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      })
      setStream(stream)
    }
  }

  const updateSample = useCallback(async () => {
    if (!stream) return
    const video = videoRef.current
    if (!video) return
    const ds = useStore.getState().ds
    const inputLayer = useStore.getState().layerConfigs[0]
    if (!inputLayer || !ds) return
    const [, height, width, channels] =
      (inputLayer.config.batchInputShape as number[]) || ds.train.shapeX
    const isMonochrome = channels === 1
    const X = tf.tidy(() => {
      const _img = getDownscaledVideo(video, height, width)
      if (!_img) return
      const img = isMonochrome ? convertToMonochrome(_img) : _img
      return img.div(255).flatten().arraySync()
    })
    if (!X) return
    const sample = { X, y: 0 }
    useStore.setState({ sample })
  }, [stream])

  const [landmarker, setLandmarker] = useState<HandLandmarker | null>(null)
  useEffect(() => {
    const createHandLandmarker = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      )
      const handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
      })
      setLandmarker(handLandmarker)
    }
    createHandLandmarker()
  }, [])

  const canvasRef = useRef<HTMLCanvasElement>(null)

  function updCanvas(results: HandLandmarkerResult) {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.save()
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (const landmarks of results.landmarks) {
      draw.drawConnectors(ctx, landmarks, hand.HAND_CONNECTIONS, {
        color: "#00FF00",
        lineWidth: 5,
        visibilityMin: -1,
      })
      draw.drawLandmarks(ctx, landmarks, {
        color: "#FF0000",
        lineWidth: 2,
        visibilityMin: -1,
      })
    }
    ctx.restore()
  }

  const hpPredict = useCallback(async () => {
    const video = videoRef.current
    if (!landmarker || !video) return
    if (!video.videoWidth || !video.videoHeight) return
    const result = landmarker.detectForVideo(video, performance.now())
    updCanvas(result)
    if (!result) return
    // const data = result.landmarks[0].map((l) => [l.x, l.y, l.z])
    const data = result.landmarks.map((l) => l.map((p) => [p.x, p.y, p.z]))
    const X = tf.tidy(() => {
      const tensor = tf.tensor(data, [data.length, 21, 3]).pad([
        [0, 2 - data.length],
        [0, 0],
        [0, 0],
      ]) // pad missing hands with zeroes to ensure shape [2, 21, 3]
      // move hand dim to the end: [2, 21, 3] -> [21, 3, 2]
      return tensor.transpose([1, 2, 0]).flatten().arraySync()
    })
    return X
  }, [landmarker])

  const hpRecordSamples = useCallback(async () => {
    const ds = useStore.getState().ds
    const outputSize = ds?.output.size
    const model = useStore.getState().model
    if (!outputSize || !model) return

    const SAMPLES = ds.storeBatchSize ?? 1
    const allY = Array.from({ length: outputSize }, (_, i) => i)
    for (const y of allY) {
      const label = ds.output.labels ? ds.output.labels[y] : y
      setStatus(`Start recording "${label}" in 3 seconds...`)
      await new Promise((resolve) => setTimeout(resolve, 3000))
      setStatus(`Recording "${label}"...`)
      let xData: number[] = []
      const yData: number[] = []
      for (const i of Array.from({ length: SAMPLES }, (_, i) => i)) {
        setStatus(`Recording "${label}": Sample ${i + 1}/${SAMPLES}`)
        await new Promise((resolve) => setTimeout(resolve, 500))
        const X = await hpPredict()
        if (!X) continue
        xData = [...xData, ...X]
        yData.push(y)
      }
      const xs = {
        data: xData as unknown as Float32Array,
        shape: [yData.length, ...HAND_DIMS],
      }
      const ys = { data: yData as unknown as Uint8Array, shape: [yData.length] }
      console.log(xs, ys)
      await addTrainData(xs, ys)
    }

    const totalSamples = useStore.getState().totalSamples()
    useStore.setState({ sampleIdx: totalSamples - 1 })
    const newSamples = allY.length * SAMPLES
    setStatus(`Done. Recorded ${newSamples} new samples.`)
  }, [hpPredict])
  useKeyCommand("r", hpRecordSamples)

  useEffect(() => {
    if (!stream) return
    const video = videoRef.current
    if (!video) return
    video.srcObject = stream
    video.play()
    /* let animationFrame: number
     captureLoop()
    async function captureLoop() {
      updateSample()
      animationFrame = requestAnimationFrame(captureLoop)
    }
    return () => {
      cancelAnimationFrame(animationFrame)
      video.srcObject = null
    } */
  }, [stream, updateSample])

  useEffect(() => {
    if (!stream) return
    let animationFrame: number
    captureLoop()
    async function captureLoop() {
      const X = await hpPredict()
      if (X) {
        const sample = { X, y: undefined }
        useStore.setState({ sample })
      }
      animationFrame = requestAnimationFrame(captureLoop)
    }
    return () => {
      cancelAnimationFrame(animationFrame)
    }
  }, [stream, hpPredict])

  const isDebug = useStore((state) => state.isDebug)
  if (!isDebug) return null

  return (
    <div className="fixed left-0 top-[112px] p-main">
      <div className="flex flex-col gap-4 mb-4">
        <InlineButton onClick={toggleStream}>
          {!!stream ? "Stop" : "Start"} Video
        </InlineButton>
        <InlineButton onClick={updateSample}>Use as Input</InlineButton>
        <InlineButton onClick={hpRecordSamples}>Record Samples</InlineButton>
      </div>
      <div
        className={`${
          !stream ? "hidden" : ""
        } relative w-60 h-auto border-2 border-accent`}
      >
        <video ref={videoRef} className="w-full h-full" />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full"
        />
      </div>
    </div>
  )
}

function getDownscaledVideo(
  video: HTMLVideoElement,
  height: number,
  width: number
) {
  return tf.tidy(() => {
    if (video.videoWidth === 0) return
    const image = tf.browser.fromPixels(video)

    const minDim = Math.min(image.shape[0], image.shape[1])
    const offsetX = (image.shape[1] - minDim) / 2
    const offsetY = (image.shape[0] - minDim) / 2

    const cropped = image.slice([offsetY, offsetX, 0], [minDim, minDim, 3])
    const downscaled = tf.image.resizeBilinear(cropped, [height, width])
    return downscaled
  })
}

function convertToMonochrome<T extends tf.Tensor>(imageTensor: T): T {
  return tf.tidy(() => {
    const [r, g, b] = tf.split(imageTensor, 3, 2)
    // Apply the luminance formula: grayscale = 0.2989 * R + 0.587 * G + 0.114 * B
    const grayscale = r.mul(0.2989).add(g.mul(0.587)).add(b.mul(0.114))
    return grayscale as T
  })
}
