import { useCallback, useEffect, useState } from "react"
import * as tf from "@tensorflow/tfjs"
import {
  FilesetResolver,
  HandLandmarker,
  NormalizedLandmark,
} from "@mediapipe/tasks-vision"
import draw from "@mediapipe/drawing_utils"
import hand from "@mediapipe/hands"
import { setStatus, useStore } from "@/store"
import { useKeyCommand } from "@/utils/key-command"
import { addTrainData } from "@/data/dataset"
import { updateSample } from "./sample"

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
  useCanvasUpdate()
  const [isRecording, toggleRecording] = useSampleRecorder(hpPredict, numHands)
  return [isRecording, toggleRecording] as const
}

function useLandmarker(numHands: number) {
  const videoRef = useStore((s) => s.videoRef)
  const [landmarker, setLandmarker] = useState<HandLandmarker | null>(null)

  useEffect(() => {
    let handLandmarker: HandLandmarker | undefined
    async function init() {
      const statusId = setStatus("Loading hand landmark model ...", -1)
      handLandmarker = await createHandLandmarker()
      setLandmarker(handLandmarker)
      useStore.getState().status.clear(statusId)
    }
    init()
    return () => {
      handLandmarker?.close()
      setLandmarker(null)
    }
  }, [])

  useEffect(() => {
    if (!landmarker) return
    landmarker.setOptions({ numHands })
  }, [landmarker, numHands])

  const hpPredict = useCallback(async () => {
    const video = videoRef?.current
    if (!landmarker || !video) return {}
    if (!video.videoWidth || !video.videoHeight) return {}
    const result = landmarker.detectForVideo(video, performance.now())

    if (!result) return {}
    let landmarks = result.landmarks
    const emptyHand = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }))
    if (numHands === 1) {
      landmarks = [landmarks[0] ?? emptyHand]
    } else if (numHands > 1) {
      const leftIdx = result.handedness.findIndex(
        (h) => h[0].categoryName === "Left"
      )
      const rightIdx = result.handedness.findIndex(
        (h) => h[0].categoryName === "Right"
      )
      landmarks = [
        landmarks[leftIdx] ?? emptyHand,
        landmarks[rightIdx] ?? emptyHand,
      ]
    }
    const data = landmarks.map(toRelativeCoords)
    const dataRaw = landmarks.map((lm) => lm.map((l) => [l.x, l.y, l.z]))
    const X = transposeLandmarks(data, numHands)
    const rawX = transposeLandmarks(dataRaw, numHands)
    return { X, rawX }
  }, [landmarker, numHands, videoRef])

  return hpPredict
}

function transposeLandmarks(data: number[][][], numHands: number) {
  return tf.tidy(() => {
    // move hand dim to the end: [2, 21, 3] -> [21, 3, 2]
    const tensor = tf.tensor(data, [numHands, 21, 3])
    return tensor.transpose([1, 2, 0]).flatten().arraySync()
  })
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

async function createHandLandmarker(numHands?: number) {
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

type PrecitFunc = ReturnType<typeof useLandmarker>

function usePredictLoop(
  stream: MediaStream | null | undefined,
  hpPredict: PrecitFunc
) {
  useEffect(() => {
    let animationFrame: number
    captureLoop()
    async function captureLoop() {
      const ds = useStore.getState().ds
      const isTraning = useStore.getState().isTraining
      if (!isTraning) {
        const { X: _X, rawX } = await hpPredict()
        if (_X) {
          const X =
            (ds?.preprocess?.(tf.tensor1d(_X)).arraySync() as number[]) ?? _X
          useStore.setState({ sample: { X, y: recordingY, rawX } })
        }
      }
      animationFrame = requestAnimationFrame(captureLoop)
    }
    return () => {
      cancelAnimationFrame(animationFrame)
      useStore.setState({ sample: undefined })
      updateSample(useStore.getState().sampleIdx)
    }
  }, [stream, hpPredict])
}

function useCanvasUpdate() {
  const stream = useStore((s) => s.stream)
  const canvasRef = useStore((s) => s.canvasRef)
  useEffect(() => {
    async function setCanvasSize() {
      // TODO: define aspect ratio in ds
      const aspectRatio = 4 / 3
      const canvas = canvasRef?.current
      if (!canvas) return
      const settings = stream?.getVideoTracks()[0].getSettings()
      canvas.width = settings?.width ? settings.width * 2 : 1280
      canvas.height = settings?.height
        ? settings.height * 2
        : canvas.width / aspectRatio
    }
    setCanvasSize()
  }, [canvasRef, stream])

  const updCanvas = useCallback(
    (landmarks: NormalizedLandmark[][]) => {
      const canvas = canvasRef?.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      ctx.save()
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const lm of landmarks) {
        draw.drawConnectors(ctx, lm, hand.HAND_CONNECTIONS, {
          color: "rgb(100,20,255)",
          lineWidth: 5,
          visibilityMin: -1,
        })
        draw.drawLandmarks(ctx, lm, {
          color: "rgb(255,20,100)",
          lineWidth: 2,
          visibilityMin: -1,
        })
      }
      ctx.restore()
    },
    [canvasRef]
  )

  const rawX = useStore((s) => s.sample?.rawX)
  const inputDims = useStore.getState().ds?.inputDims
  useEffect(() => {
    if (!rawX || !inputDims) return
    if (rawX.length !== inputDims.reduce((a, b) => a * b)) return
    const shapedX = tf.tidy(() =>
      tf.tensor(rawX, inputDims).transpose([2, 0, 1]).arraySync()
    ) as number[][][]
    const landmarks = shapedX.map((lm) =>
      lm.map(([x, y, z]) => ({ x, y, z, visibility: 0 }))
    )
    updCanvas(landmarks)
  }, [rawX, inputDims, updCanvas])
}

function useSampleRecorder(hpPredict: PrecitFunc, numHands: number) {
  const isRecording = useStore((s) => s.isRecording)
  const toggleRecording = useStore((s) => s.toggleRecording)

  const hpRecordSamples = useCallback(async () => {
    const ds = useStore.getState().ds
    const outputSize = ds?.outputLabels.length
    if (!outputSize) return

    const SAMPLES = ds.storeBatchSize
    const STATUS_ID = "hpRecordSamples"
    const SECONDS_BEFORE_RECORDING = 3
    const allY = Array.from({ length: outputSize }, (_, i) => i)
    for (const y of allY) {
      recordingY = y
      const label = ds.outputLabels ? ds.outputLabels[y] : y
      for (let s = SECONDS_BEFORE_RECORDING; s > 0; s--) {
        setStatus(`Start recording "${label}" in ${s} seconds ...`, -1, {
          id: STATUS_ID,
          fullscreen: true,
        })
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
      setStatus(`Recording "${label}" ...`, 0, { id: STATUS_ID })
      let xData: number[] = []
      let xDataRaw: number[] = []
      const yData: number[] = []
      for (const i of Array.from({ length: SAMPLES }, (_, i) => i)) {
        if (!useStore.getState().isRecording) {
          setStatus(`Recording canceled.`, null, { id: STATUS_ID })
          return
        }
        const percent = (i + 1) / SAMPLES
        setStatus(`Recording "${label}": Sample ${i + 1}/${SAMPLES}`, percent, {
          id: STATUS_ID,
          fullscreen: true,
        })
        await new Promise((resolve) => setTimeout(resolve, 100))
        const { X, rawX } = await hpPredict()
        if (!X) continue
        xData = [...xData, ...X]
        xDataRaw = [...xDataRaw, ...rawX]
        yData.push(y)
      }
      const xs = {
        data: xData as unknown as Float32Array,
        shape: [yData.length, 21, 3, numHands],
      }
      const xsRaw = {
        data: xDataRaw as unknown as Float32Array,
        shape: [yData.length, 21, 3, numHands],
      }
      const ys = { data: yData as unknown as Uint8Array, shape: [yData.length] }
      recordingY = undefined
      await addTrainData(xs, ys, xsRaw)
    }

    const newSamples = allY.length * SAMPLES
    for (let s = 2; s > 0; s--) {
      setStatus(
        `Recorded ${newSamples} new samples. Starting training in ${s} seconds ...`,
        -1,
        { id: STATUS_ID, fullscreen: true }
      )
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    useStore.getState().status.clear(STATUS_ID)
    hpTrain()
    useStore.setState({ isRecording: false })
  }, [hpPredict, numHands])

  useEffect(() => {
    if (!isRecording) return
    hpRecordSamples()
  }, [isRecording, hpRecordSamples])

  useKeyCommand("r", toggleRecording)
  return [isRecording, toggleRecording] as const
}

function hpTrain() {
  useStore.getState().setTrainConfig(HP_TRAIN_CONFIG)
  useStore.setState({ isTraining: true, logsMetric: "val_loss" })
}
