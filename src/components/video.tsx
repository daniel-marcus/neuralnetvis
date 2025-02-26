import { useCallback, useEffect, useRef, useState } from "react"
import * as tf from "@tensorflow/tfjs"
import { setStatus, setTab, useStore } from "@/store"
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

export function VideoWindow() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stream = useStore((s) => s.stream)

  useEffect(() => {
    useStore.setState({ videoRef, canvasRef })
    return () => {
      useStore.setState({ videoRef: undefined, canvasRef: undefined })
    }
  }, [videoRef, canvasRef])

  return (
    <div className="fixed left-0 bottom-0 sm:bottom-auto sm:top-[112px] p-main w-[320px]">
      <VideoControl />
      <div className={`${!stream ? "hidden" : ""} relative w-full h-auto`}>
        <video
          ref={videoRef}
          className="w-full h-full"
          width="320"
          height="240"
          playsInline
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full"
        />
      </div>
    </div>
  )
}

export function VideoControl() {
  const videoRef = useStore((s) => s.videoRef)
  const stream = useStore((s) => s.stream)
  const toggleStream = useStore((s) => s.toggleStream)

  const numHands = useStore((s) => s.ds?.train.shapeX[3] ?? 1)
  const hpPredict = useLandmarker(numHands)

  const hpRecordSamples = useCallback(async () => {
    const ds = useStore.getState().ds
    const outputSize = ds?.output.labels.length
    const model = useStore.getState().model
    if (!outputSize || !model) return
    const outputLayerIdx = model.layers.length - 1

    const SAMPLES = ds.storeBatchSize ?? 1
    const allY = Array.from({ length: outputSize }, (_, i) => i)
    for (const y of allY) {
      const selectedNid = `${outputLayerIdx}_${y}.0.0`
      useStore.setState({ selectedNid })
      const label = ds.output.labels ? ds.output.labels[y] : y
      const SECONDS_BEFORE_RECORDING = 3
      for (let s = SECONDS_BEFORE_RECORDING; s > 0; s--) {
        setStatus(`Start recording "${label}" in ${s} seconds...`, -1)
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
      setStatus(`Recording "${label}" ...`, 0)
      let xData: number[] = []
      const yData: number[] = []
      for (const i of Array.from({ length: SAMPLES }, (_, i) => i)) {
        const percent = (i + 1) / SAMPLES
        setStatus(`Recording "${label}": Sample ${i + 1}/${SAMPLES}`, percent)
        await new Promise((resolve) => setTimeout(resolve, 100))
        const X = await hpPredict()
        if (!X) continue
        xData = [...xData, ...X]
        yData.push(y)
      }
      const xs = {
        data: xData as unknown as Float32Array,
        shape: [yData.length, 21, 3, numHands],
      }
      const ys = { data: yData as unknown as Uint8Array, shape: [yData.length] }
      await addTrainData(xs, ys)
    }

    const totalSamples = useStore.getState().totalSamples()
    useStore.setState({ sampleIdx: totalSamples - 1, selectedNid: undefined })
    const newSamples = allY.length * SAMPLES
    setStatus(`Done. Recorded ${newSamples} new samples.`, null)
  }, [hpPredict, numHands])
  useKeyCommand("r", hpRecordSamples)

  useEffect(() => {
    const video = videoRef?.current
    if (!video || !stream) return
    video.srcObject = stream
    video.play().catch(console.warn)
    let animationFrame: number
    captureLoop()
    async function captureLoop() {
      // updateSample()
      const isTraning = useStore.getState().isTraining
      if (!isTraning) {
        const X = await hpPredict()
        if (X) {
          const sample = { X, y: undefined }
          useStore.setState({ sample })
        }
      }
      animationFrame = requestAnimationFrame(captureLoop)
    }
    return () => {
      cancelAnimationFrame(animationFrame)
      video.srcObject = null
    }
  }, [stream, hpPredict, videoRef])

  const totalSamples = useStore((s) => s.totalSamples())

  async function train() {
    const trainConfig = { batchSize: 16, epochs: 100, validationSplit: 0.1 }
    useStore.getState().setTrainConfig(trainConfig)
    setTab("train")
    useStore.setState({ isTraining: true, logsMetric: "val_loss" })
  }

  return (
    <div className="flex mb-4 gap-2 justify-between">
      <InlineButton onClick={toggleStream}>
        {!!stream ? "close" : "open"} video
      </InlineButton>
      <InlineButton onClick={hpRecordSamples} disabled={!stream}>
        record
      </InlineButton>
      <InlineButton onClick={train} disabled={!totalSamples}>
        train
      </InlineButton>
    </div>
  )
}

function useLandmarker(numHands: number) {
  const videoRef = useStore((s) => s.videoRef)
  const canvasRef = useStore((s) => s.canvasRef)
  const [landmarker, setLandmarker] = useState<HandLandmarker | null>(null)
  useEffect(() => {
    async function init() {
      const landmarker = await createHandLandmarker(numHands)
      setLandmarker(landmarker)
    }
    init()
    return () => {
      setLandmarker(null)
    }
  }, [numHands])

  const updCanvas = useCallback(
    (results: HandLandmarkerResult) => {
      const video = videoRef?.current
      const canvas = canvasRef?.current
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
    },
    [videoRef, canvasRef]
  )

  const hpPredict = useCallback(async () => {
    const video = videoRef?.current
    if (!landmarker || !video) return
    if (!video.videoWidth || !video.videoHeight) return
    const result = landmarker.detectForVideo(video, performance.now())
    updCanvas(result)
    if (!result) return
    let landmarks = result.landmarks
    if (numHands > 1) {
      const leftIdx = result.handedness.findIndex(
        (h) => h[0].categoryName === "Left"
      )
      const rightIdx = result.handedness.findIndex(
        (h) => h[0].categoryName === "Right"
      )
      const emptyHand = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }))
      landmarks = [
        landmarks[leftIdx] ?? emptyHand,
        landmarks[rightIdx] ?? emptyHand,
      ]
    }
    const data = landmarks.map((l) => l.map((p) => [p.x, p.y, p.z]))
    const X = tf.tidy(() => {
      const tensor = tf.tensor(data, [data.length, 21, 3]).pad([
        [0, numHands - data.length],
        [0, 0],
        [0, 0],
      ]) // pad missing hands with zeroes to ensure shape [2, 21, 3]
      // move hand dim to the end: [2, 21, 3] -> [21, 3, 2]
      return tensor.transpose([1, 2, 0]).flatten().arraySync()
    })
    return X
  }, [landmarker, numHands, updCanvas, videoRef])
  return hpPredict
}

async function createHandLandmarker(numHands: number) {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  )
  const handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands,
  })
  return handLandmarker
}

/* const updateSample = useCallback(async () => {
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
    const sample = { X, y: undefined }
    useStore.setState({ sample })
  }, [stream])

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
}  */
