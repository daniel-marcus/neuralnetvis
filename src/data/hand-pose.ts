import { useCallback, useEffect, useState } from "react"
import * as tf from "@tensorflow/tfjs"
import {
  FilesetResolver,
  HandLandmarker,
  NormalizedLandmark,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision"
import * as draw from "@mediapipe/drawing_utils"
import * as hand from "@mediapipe/hands"
import { setStatus, useStore } from "@/store"
import { useKeyCommand } from "@/utils/key-command"
import { addTrainData } from "@/data/dataset"

const HP_TRAIN_CONFIG = {
  batchSize: 16,
  epochs: 100,
  validationSplit: 0.1,
  lazyLoading: false,
}

export function useHandPose(stream: MediaStream | null | undefined) {
  const numHands = useStore((s) => s.ds?.inputDims[2] ?? 1)
  const hpPredict = useLandmarker(numHands)
  usePredictLoop(stream, hpPredict)
  const hpRecordSamples = useSampleRecorder(hpPredict, numHands)
  const hasSamples = !!useStore((s) => s.totalSamples())
  const train = hasSamples ? hpTrain : undefined
  return [hpRecordSamples, train] as const
}

function useLandmarker(numHands: number) {
  const videoRef = useStore((s) => s.videoRef)
  const canvasRef = useStore((s) => s.canvasRef)
  const [landmarker, setLandmarker] = useState<HandLandmarker | null>(null)
  useEffect(() => {
    async function init() {
      setStatus("Loading hand landmark model...", -1)
      const landmarker = await createHandLandmarker(numHands)
      setLandmarker(landmarker)
      setStatus("", null)
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
      canvas.width = video.videoWidth * 2
      canvas.height = video.videoHeight * 2
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      ctx.save()
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const landmarks of results.landmarks) {
        draw.drawConnectors(ctx, landmarks, hand.HAND_CONNECTIONS, {
          color: "rgb(100,20,255)",
          lineWidth: 5,
          visibilityMin: -1,
        })
        draw.drawLandmarks(ctx, landmarks, {
          color: "rgb(255,20,100)",
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
    const data = landmarks.map(toRelativeCoords)
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

function toRelativeCoords(
  landmarks: NormalizedLandmark[]
): [number, number, number][] {
  // get positions gelative to wrist & invert y axis
  const wrist = landmarks[0]
  return landmarks.map((l) => {
    return [l.x - wrist.x, -1 * (l.y - wrist.y), l.z - wrist.z]
  })
}

async function createHandLandmarker(numHands: number) {
  // TODO: add to public folder
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  )
  const handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task`,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands,
  })
  return handLandmarker
}

let recordingY: number | undefined = undefined

function usePredictLoop(
  stream: MediaStream | null | undefined,
  hpPredict: () => Promise<number[] | undefined>
) {
  useEffect(() => {
    let animationFrame: number
    captureLoop()
    async function captureLoop() {
      const isTraning = useStore.getState().isTraining
      if (!isTraning) {
        const X = await hpPredict()
        if (X) useStore.setState({ sample: { X, y: recordingY } })
      }
      animationFrame = requestAnimationFrame(captureLoop)
    }
    return () => {
      cancelAnimationFrame(animationFrame)
    }
  }, [stream, hpPredict])
}

function useSampleRecorder(
  hpPredict: () => Promise<number[] | undefined>,
  numHands: number
) {
  const hpRecordSamples = useCallback(async () => {
    const ds = useStore.getState().ds
    const outputSize = ds?.outputLabels.length
    if (!outputSize) return

    const SAMPLES = ds.storeBatchSize
    const allY = Array.from({ length: outputSize }, (_, i) => i)
    for (const y of allY) {
      recordingY = y
      const label = ds.outputLabels ? ds.outputLabels[y] : y
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
      recordingY = undefined
      await addTrainData(xs, ys)
    }

    const totalSamples = useStore.getState().totalSamples()
    useStore.setState({ sampleIdx: totalSamples - 1, selectedNid: undefined })
    const newSamples = allY.length * SAMPLES
    setStatus(`Recorded ${newSamples} new samples. Ready for training.`, null)
  }, [hpPredict, numHands])
  useKeyCommand("r", hpRecordSamples)
  return hpRecordSamples
}

function hpTrain() {
  useStore.getState().setTrainConfig(HP_TRAIN_CONFIG)
  useStore.setState({ isTraining: true, logsMetric: "val_loss" })
}
