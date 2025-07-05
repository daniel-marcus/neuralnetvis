import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as tf from "@tensorflow/tfjs"
import { getSample } from "@/data/sample"
import { useSceneStore } from "@/store"
import { drawHandPoseSampleToCanvas } from "@/data/hand-pose"
import { useMaskMode } from "@/scene-views/blur-mask"
import { useKeyCommand } from "@/utils/key-command"
import { cameraOffSvg, cameraSvg, useVideoControl } from "./video"
import { useMySample } from "@/data/my-sample"
import type { SampleRaw } from "@/data"
import { resetData } from "@/data/dataset"

export function SampleViewer() {
  const idxs = useSceneStore((s) => s.sampleViewerIdxs)
  const [offset, setOffset] = useState(0)
  const [samples, setSamples] = useState<SampleRaw[]>([])
  const ds = useSceneStore((s) => s.ds)
  const subset = useSceneStore((s) => s.subset)
  const itemsPerPage = 16
  useEffect(() => {
    setOffset(0)
    setSamples([])
  }, [idxs])
  useEffect(() => {
    async function getSamples() {
      if (!ds) return
      const newSamples: SampleRaw[] = []
      for (const idx of idxs.slice(offset, offset + itemsPerPage)) {
        const sample = await getSample(ds, subset, idx)
        if (sample) newSamples.push(sample)
      }
      setSamples(newSamples)
    }
    getSamples()
  }, [idxs, ds, subset, offset, itemsPerPage])
  const sampleIdx = useSceneStore((s) => s.sampleIdx)
  const setSampleIdx = useSceneStore((s) => s.setSampleIdx)
  const hasBlur = !!useMaskMode()
  useKeyboardNavigation(idxs, itemsPerPage, setOffset)

  const isLayersView = useSceneStore((s) => s.view === "layers")
  const camAspectRatio = useSceneStore((s) => s.getAspectRatio())
  const aspectRatio = ds?.camProps ? camAspectRatio : 1

  if (!samples.length && !isLayersView) return null
  return (
    <div
      className={`-mb-4! pt-4 pb-8 bg-gradient-to-b from-transparent ${
        hasBlur ? "via-[1rem] via-black to-black" : "to-background"
      } transition-colors duration-300 w-screen bottom-0 right-0 [--item-size:70px] sm:[--item-size:80px] pointer-events-none`}
      style={{ "--item-aspect-ratio": aspectRatio } as React.CSSProperties}
    >
      <div className={`flex justify-center items-start`}>
        <div
          className={`flex items-center justify-start gap-2 overflow-auto no-scrollbar px-4 mx-auto  pointer-events-auto`}
        >
          {isLayersView && <VideoCaptureBtn />}
          {isLayersView && <AddSampleBtn />}
          {samples.map((sample, i) => {
            const idx = idxs[offset + i]
            const isCurrent = typeof idx !== "undefined" && idx === sampleIdx
            return (
              <button
                key={i}
                onClick={() => setSampleIdx(isCurrent ? undefined : idx)}
              >
                <SamplePreview sample={sample} isCurrent={isCurrent} />
              </button>
            )
          })}
        </div>
      </div>
      <Pagination
        total={idxs.length}
        itemsPerPage={itemsPerPage}
        offset={offset}
        setOffset={setOffset}
      />
    </div>
  )
}

function VideoCaptureBtn() {
  const ds = useSceneStore((s) => s.ds)
  const [stream, toggleStream, recorder] = useVideoControl()
  if (!ds?.camProps) return null
  // TODO: styles as reusable component
  return (
    <button
      className={`flex-none border-2 w-[var(--item-size)] rounded-md hover:border-marker ${
        !!stream ? "border-accent" : ""
      } aspect-[var(--item-aspect-ratio)]`}
      onClick={toggleStream}
    >
      {stream ? cameraOffSvg : cameraSvg}
      {recorder}
    </button>
  )
}

function AddSampleBtn() {
  const onClick = useMySample()
  const ds = useSceneStore((s) => s.ds)
  const hasRecIcon =
    ds?.camProps?.processor === "handPose" && ds?.isUserGenerated
  const isRecording = useSceneStore((s) => s.isRecording)
  const stream = useSceneStore((s) => s.stream)
  const icon = hasRecIcon ? "●" : "+"
  return (
    <>
      {!!onClick && (
        <button
          className={`flex-none border-2 w-[var(--item-size)] rounded-md hover:border-marker ${
            isRecording ? "border-accent animate-recording-pulse" : ""
          } ${
            hasRecIcon ? "text-accent" : ""
          } aspect-[var(--item-aspect-ratio)]`}
          onClick={onClick}
        >
          {icon}
        </button>
      )}
      {ds?.isUserGenerated && !!ds.train.totalSamples && !stream && (
        <button
          className={`flex-none border-2 w-[var(--item-size)] rounded-md hover:border-marker aspect-[var(--item-aspect-ratio)]`}
          onClick={async () => {
            const confirm = window.confirm(
              "Are you sure you want to clear all recorded samples?"
            )
            if (confirm) await resetData(ds.key, "train")
          }}
        >
          x
        </button>
      )}
    </>
  )
}

function useKeyboardNavigation(
  idxs: number[],
  itemsPerPage: number,
  setOffset: React.Dispatch<React.SetStateAction<number>>
) {
  const sampleIdx = useSceneStore((s) => s.sampleIdx)
  const setSampleIdx = useSceneStore((s) => s.setSampleIdx)
  const nextLocal = useCallback(
    (step = 1) =>
      setSampleIdx((prevIdx) => {
        const currLocalIdx = prevIdx ? idxs.indexOf(prevIdx) : -1
        return idxs[currLocalIdx + step]
      }),
    [idxs, setSampleIdx]
  )
  const prev = useCallback(() => nextLocal(-1), [nextLocal])
  const next = useCallback(() => nextLocal(1), [nextLocal])
  useKeyCommand("ArrowLeft", prev, !!idxs.length)
  useKeyCommand("ArrowRight", next, !!idxs.length)
  useEffect(() => {
    // update offset if sampleIdx is not in the current page
    const localIdx = idxs.indexOf(sampleIdx ?? -1)
    if (localIdx < 0) return
    setOffset((currOffset) => {
      const newOffset = Math.floor(localIdx / itemsPerPage) * itemsPerPage
      if (currOffset !== newOffset) return newOffset
      return currOffset
    })
  }, [sampleIdx, setOffset, idxs, itemsPerPage])
}

interface PaginationProps {
  total: number
  itemsPerPage: number
  offset: number
  setOffset: React.Dispatch<React.SetStateAction<number>>
}

function Pagination({
  total,
  itemsPerPage,
  offset,
  setOffset,
}: PaginationProps) {
  const page = Math.floor(offset / itemsPerPage)
  const setPage = (newPage: number) => setOffset(newPage * itemsPerPage)
  const totalPages = Math.ceil(total / itemsPerPage)
  const isFirstPage = page === 0
  const isLastPage = page === totalPages - 1 || totalPages === 0
  if (totalPages <= 1) return null
  // TODO: replace paginaton with infinite scroll w/ autoload
  return (
    <div
      className={`w-full max-w-[380px] mx-auto flex justify-between items-center mt-2 pointer-events-auto`}
    >
      <button
        className={`px-4 py-0 ${isFirstPage ? "opacity-0" : ""}`}
        disabled={page === 0}
        onClick={() => setPage(Math.max(page - 1, 0))}
      >
        &lt; prev
      </button>
      <div className={totalPages <= 1 ? "hidden" : ""}>
        {page + 1}/{totalPages}
      </div>
      <button
        className={`px-4 py-0  ${isLastPage ? "opacity-0" : ""}`}
        disabled={isLastPage}
        onClick={() => setPage(Math.min(page + 1, totalPages - 1))}
      >
        next &gt;
      </button>
    </div>
  )
}

type ImgShape = [number, number, number]

const VIDEO_BASE_SIZE = 640 // x 480 -> 4:3 aspect ratio

interface SamplePreviewProps {
  sample: SampleRaw
  isCurrent?: boolean
}

function SamplePreview({ sample, isCurrent }: SamplePreviewProps) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!isCurrent) return
    const el = ref.current
    el?.scrollIntoView({ behavior: "smooth" })
    return () => el?.parentElement?.blur()
  }, [isCurrent])
  const isTextSample = useSceneStore((s) => !!s.ds?.tokenizer)
  const Preview = isTextSample ? TokenPreview : CanvasPreview
  return (
    <div
      className={`border-2 ${
        isCurrent ? "border-accent" : "border-menu-border"
      } hover:border-marker rounded-md overflow-hidden w-[var(--item-size)]`}
      ref={ref}
    >
      <Preview sample={sample} />
    </div>
  )
}

function TokenPreview({ sample }: SamplePreviewProps) {
  const tokenizer = useSceneStore((s) => s.ds?.tokenizer)
  const text = useMemo(() => {
    if (!tokenizer || !sample.X) return ""
    const tokens = [...sample.X].slice(1, 31).map(tokenizer.decode)
    return tokens.join(" ") // using non-breaking space to allow arbitrary line breaks
  }, [sample.X, tokenizer])
  return (
    <div className="text-[9px] w-full h-[var(--item-size)] text-left break-words leading-none">
      {text}
    </div>
  )
}

function CanvasPreview({ sample }: SamplePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const camProps = useSceneStore((s) => s.ds?.camProps)
  const aspectRatio = useSceneStore((s) => s.getAspectRatio())
  const hasCam = !!camProps
  const camProcessor = useSceneStore((s) => s.ds?.camProps?.processor)
  const inputDims = useSceneStore((s) => s.ds?.inputDims)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!inputDims || !sample || !canvas) return
    if (camProcessor === "handPose")
      drawHandPoseSampleToCanvas(sample, inputDims, canvas)
    else drawImageSampleToCanvas(sample, inputDims, canvas)
  }, [inputDims, sample, camProcessor])
  return (
    <canvas
      className={`w-full ${hasCam ? "scale-x-[-1] bg-box" : ""} `}
      width={hasCam ? VIDEO_BASE_SIZE : inputDims?.[1]}
      height={hasCam ? VIDEO_BASE_SIZE / aspectRatio : inputDims?.[2]}
      ref={canvasRef}
    />
  )
}

function drawImageSampleToCanvas(
  sample: SampleRaw,
  inputDims: number[],
  canvas: HTMLCanvasElement
) {
  try {
    tf.tidy(() => {
      const img = tf.tensor(
        sample.X,
        inputDims as ImgShape,
        "int32"
      ) as tf.Tensor3D
      const backend = tf.getBackend()
      const draw = backend === "wasm" ? tf.browser.toPixels : tf.browser.draw
      draw(img, canvas)
    })
  } catch (e) {
    console.warn(e)
  }
}
