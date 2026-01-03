import { useCallback, useEffect } from "react"
import * as tf from "@tensorflow/tfjs"
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision"
import draw from "@mediapipe/drawing_utils"
import hand from "@mediapipe/hands"
import { clearStatus, setStatus, useGlobalStore, useSceneStore } from "@/store"
import { addTrainData, resetData } from "@/data/dataset"
import { useDomRefs } from "@/utils/dom-refs"
import { useCaptureLoop } from "./video-capture"
import { CustomBtn } from "@/scene-views/sample-viewer-btns"
import type { CaptureFunc, RecorderProps } from "./video-capture"
import type { SampleRaw } from "./types"

const HP_TRAIN_CONFIG = {
  batchSize: 4,
  epochs: 100,
  validationSplit: 0.1,
  lazyLoading: false,
}

export function HandPoseCapture({ stream }: RecorderProps) {
  useHpTrainConfig()
  const ds = useSceneStore((s) => s.ds)
  const numHands = ds?.inputDims[2] ?? 1
  const hpPredict = useLandmarker(numHands, stream)
  useCaptureLoop(stream, hpPredict)
  const toggleRecording = useSampleRecorder(hpPredict, numHands)

  const isRecording = useSceneStore((s) => s.isRecording)
  const setTab = useGlobalStore((s) => s.setTab)
  const openNewDsTab = useCallback(() => setTab("data"), [setTab])

  if (!ds?.isUserGenerated)
    return <CustomBtn onClick={openNewDsTab}>+</CustomBtn>
  else if (stream)
    return (
      <CustomBtn
        onClick={toggleRecording}
        className={`${isRecording ? "border-accent animate-recording-pulse" : "border-gray-400"} text-accent`}
      >
        ●
      </CustomBtn>
    )
  else if (!!ds.train.totalSamples)
    return (
      <CustomBtn
        onClick={async () => {
          const confirm = window.confirm(
            "Are you sure you want to clear all recorded samples?",
          )
          if (confirm) await resetData(ds.key, "train")
        }}
      >
        x
      </CustomBtn>
    )
  return null
}

function useLandmarker(numHands: number, stream?: MediaStream) {
  const landmarker = useGlobalStore((s) => s.handLandmarker)

  useEffect(() => {
    if (!stream || landmarker) return
    let handLandmarker: HandLandmarker | undefined
    async function init() {
      const statusId = setStatus("Loading hand landmark model ...", -1)
      handLandmarker = await createHandLandmarker()
      useGlobalStore.setState({ handLandmarker })
      clearStatus(statusId)
    }
    init()
  }, [stream, landmarker])

  useEffect(() => {
    if (!landmarker) return
    landmarker.setOptions({ numHands })
  }, [landmarker, numHands])

  const hpPredict: CaptureFunc = useCallback(
    async (video?: HTMLVideoElement) => {
      if (!landmarker || !video) return
      if (!video.videoWidth || !video.videoHeight) return
      const result = landmarker.detectForVideo(video, performance.now())

      if (!result) return
      let landmarks = result.landmarks
      const emptyHand = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }))
      if (numHands === 1) {
        landmarks = [landmarks[0] ?? emptyHand]
      } else if (numHands > 1) {
        const leftIdx = result.handedness.findIndex(
          (h) => h[0].categoryName === "Left",
        )
        const rightIdx = result.handedness.findIndex(
          (h) => h[0].categoryName === "Right",
        )
        landmarks = [
          landmarks[leftIdx] ?? emptyHand,
          landmarks[rightIdx] ?? emptyHand,
        ]
      }
      // const data = landmarks.map(toRelativeCoords)
      const dataRaw = landmarks.map((lm) => lm.map((l) => [l.x, l.y, l.z]))
      // const X = transposeLandmarks(data, numHands)
      const rawX = transposeLandmarks(dataRaw, numHands)
      return rawX
    },
    [landmarker, numHands],
  )

  return hpPredict
}

function transposeLandmarks(data: number[][][], numHands: number) {
  return tf.tidy(() => {
    // move hand dim to the end: [2, 21, 3] -> [21, 3, 2]
    const tensor = tf.tensor(data, [numHands, 21, 3])
    return tensor.transpose([1, 2, 0]).flatten().arraySync()
  })
}

/* function toRelativeCoords(
  landmarks: NormalizedLandmark[]
): [number, number, number][] {
  // get positions gelative to wrist & invert y axis
  const wrist = landmarks[0]
  return landmarks.map((l) => {
    return [l.x - wrist.x, -1 * (l.y - wrist.y), l.z - wrist.z]
  })
} */

async function createHandLandmarker(numHands?: number) {
  // TODO: add to public folder
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
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

function setCanvasDefaultSize(canvas: HTMLCanvasElement, aspectRatio: number) {
  canvas.width = 1280
  canvas.height = 1280 / aspectRatio
}

function setCanvasSize(canvas: HTMLCanvasElement, w: number, h: number) {
  canvas.width = w
  canvas.height = h
}

export function HandPoseCanvasUpdater() {
  const { videoRef, canvasRef } = useDomRefs()
  const aspectRatio = useSceneStore((s) => s.getAspectRatio())
  const stream = useSceneStore((s) => s.stream)
  useEffect(() => {
    if (!canvasRef.current) return
    setCanvasDefaultSize(canvasRef.current, aspectRatio)
  }, [canvasRef, aspectRatio])
  useEffect(() => {
    const canvas = canvasRef.current
    if (!stream || !canvas) return
    // reset canvas to default after stream
    return () => setCanvasDefaultSize(canvas, aspectRatio)
  }, [canvasRef, stream, aspectRatio])

  const sample = useSceneStore((s) => s.sample)
  const inputDims = useSceneStore((s) => s.ds?.inputDims)
  useEffect(() => {
    const canvas = canvasRef?.current
    if (!canvas) return
    if (videoRef?.current?.videoWidth) {
      const dpr = window.devicePixelRatio || 1
      const width = videoRef.current.videoWidth * dpr
      const height = videoRef.current.videoHeight * dpr
      setCanvasSize(canvas, width, height)
    }
    drawHandPoseSampleToCanvas(sample, inputDims, canvas)
  }, [sample, inputDims, canvasRef, videoRef])
  return null
}

let shouldCancelRecording = false

const RECORDING_STATUS_ID = "hpRecordSamples"

function useSampleRecorder(hpPredict: CaptureFunc, numHands: number) {
  const { videoRef } = useDomRefs()
  const isRecording = useSceneStore((s) => s.isRecording)
  const setIsRecording = useSceneStore((s) => s.setIsRecording)

  const ds = useSceneStore((s) => s.ds)
  const updMeta = useSceneStore((s) => s.updateMeta)
  const hpTrain = useSceneStore((s) => s.toggleTraining)
  const stream = useSceneStore((s) => s.stream)
  const setRecY = useSceneStore((s) => s.setRecordingY)

  const hpRecordSamples = async () => {
    const video = videoRef.current
    if (!stream || !video) return
    shouldCancelRecording = false
    const outputSize = ds?.outputLabels.length
    if (!outputSize) return

    const SAMPLES = ds.storeBatchSize
    const SECONDS_BEFORE_RECORDING = 3

    const allY = Array.from({ length: outputSize }, (_, i) => i)
    for (const y of allY) {
      setRecY(y)
      const label = ds.outputLabels ? ds.outputLabels[y] : y
      for (let s = SECONDS_BEFORE_RECORDING; s > 0; s--) {
        setStatus(`Start recording "${label}" in ${s} seconds ...`, -1, {
          id: RECORDING_STATUS_ID,
          fullscreen: true,
        })
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
      setStatus(`Recording "${label}" ...`, 0, { id: RECORDING_STATUS_ID })
      let xData: number[] = []
      const yData: number[] = []
      for (const i of Array.from({ length: SAMPLES }, (_, i) => i)) {
        if (shouldCancelRecording) {
          setStatus(`Recording canceled.`, null, { id: RECORDING_STATUS_ID })
          return
        }
        const percent = (i + 1) / SAMPLES
        setStatus(`Recording "${label}": Sample ${i + 1}/${SAMPLES}`, percent, {
          id: RECORDING_STATUS_ID,
          fullscreen: true,
        })
        await new Promise((resolve) => setTimeout(resolve, 100))
        const X = await hpPredict(video)
        if (!X) continue
        xData = [...xData, ...X]
        yData.push(y)
      }
      const xs = {
        data: Float32Array.from(xData),
        shape: [yData.length, 21, 3, numHands],
      }
      const ys = { data: Uint8Array.from(yData), shape: [yData.length] }
      setRecY(undefined)
      const aspectRatio = getAspectRatioFromStream(stream)
      const trainMeta = await addTrainData(ds, xs, ys, undefined, aspectRatio)
      updMeta("train", trainMeta)
    }

    const newSamples = allY.length * SAMPLES
    for (let s = 2; s > 0; s--) {
      setStatus(
        `Recorded ${newSamples} new samples. Starting training in ${s} seconds ...`,
        -1,
        { id: RECORDING_STATUS_ID, fullscreen: true },
      )
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    useGlobalStore.getState().status.clear(RECORDING_STATUS_ID)
    hpTrain()
  }

  const toggleRecording = async () => {
    if (isRecording) {
      shouldCancelRecording = true
      setIsRecording(false)
    } else {
      setIsRecording(true)
      await hpRecordSamples()
      setIsRecording(false)
    }
  }

  return toggleRecording
}

function getAspectRatioFromStream(stream: MediaStream) {
  return stream.getVideoTracks()[0].getSettings().aspectRatio
}

function useHpTrainConfig() {
  const setTrainConfig = useSceneStore((s) => s.setTrainConfig)
  const setLogsMetric = useSceneStore((s) => s.setLogsMetric)
  useEffect(() => {
    setTrainConfig(HP_TRAIN_CONFIG)
    setLogsMetric("val_loss")
  }, [setTrainConfig, setLogsMetric])
}

function sampleToLandmarks(sample?: SampleRaw, inputDims?: number[]) {
  const rawX = sample?.rawX ?? sample?.X
  if (!rawX || !inputDims) return
  if (rawX.length !== inputDims.reduce((a, b) => a * b)) return
  const shapedX = tf.tidy(() =>
    tf.tensor(rawX, inputDims).transpose([2, 0, 1]).arraySync(),
  ) as number[][][]
  const landmarks = shapedX.map((lm) =>
    lm.map(([x, y, z]) => ({ x, y, z, visibility: 0 })),
  )
  return landmarks
}

export function drawHandPoseSampleToCanvas(
  sample?: SampleRaw,
  inputDims?: number[],
  canvas?: HTMLCanvasElement,
) {
  const ctx = canvas?.getContext("2d")
  if (!canvas || !ctx) return

  const landmarks = sampleToLandmarks(sample, inputDims) ?? []

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
}
