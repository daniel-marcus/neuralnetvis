import { useCallback, useEffect, useRef, useState } from "react"
import * as tf from "@tensorflow/tfjs"
import type { SampleRaw } from "@/data"
import { getSample } from "@/data/sample"
import { useCurrScene, useSceneStore } from "@/store"
import { drawHandPoseSampleToCanvas } from "@/data/hand-pose"
import { useMaskMode } from "@/scene-views/blur-mask"
import { useKeyCommand } from "@/utils/key-command"
import { cameraOffSvg, cameraSvg, useVideoControl } from "./video"
import { useExternalSample } from "@/data/external-sample"

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
  const sampleIdx = useCurrScene((s) => s.sampleIdx)
  const setSampleIdx = useCurrScene((s) => s.setSampleIdx)
  const hasBlur = !!useMaskMode()
  useKeyboardNavigation(idxs, itemsPerPage, setOffset)

  if (!samples.length) return null
  return (
    <div
      className={`-my-4 _py-4! bg-gradient-to-b from-transparent _via-[1rem] ${
        hasBlur ? "_via-black to-black" : "_via-background to-background"
      } transition-colors duration-300 w-screen bottom-0 right-0 [--item-size:70px] sm:[--item-size:80px] pointer-events-none`}
    >
      <div className={`flex justify-center items-start`}>
        <div
          className={`flex items-start justify-start gap-2 overflow-auto no-scrollbar px-4 mx-auto  pointer-events-auto`}
        >
          <VideoCaptureBtn />
          <AddSampleBtn />
          {samples.map((sample, i) => {
            const idx = idxs[offset + i]
            const isCurrent = typeof idx !== "undefined" && idx === sampleIdx
            return (
              <button
                key={i}
                onClick={() => setSampleIdx(isCurrent ? undefined : idx)}
              >
                <SampleCanvas sample={sample} isCurrent={isCurrent} />
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
  const ds = useCurrScene((s) => s.ds)
  const [stream, toggleStream, recorder] = useVideoControl()
  if (!ds?.camProps) return null
  // TODO: styles as reusable component
  return (
    <button
      className={`flex-none border-2 w-[var(--item-size)] aspect-square rounded-md hover:border-marker ${
        !!stream ? "border-accent" : ""
      }`}
      onClick={toggleStream}
    >
      {stream ? cameraOffSvg : cameraSvg}
      {recorder}
    </button>
  )
}

function AddSampleBtn() {
  const onClick = useExternalSample()
  // TODO: use for hand pose recorindg also
  // - conditions when to show
  // - add to dataset?
  return (
    <button
      className={`flex-none border-2 w-[var(--item-size)] aspect-square rounded-md hover:border-marker `}
      onClick={onClick}
    >
      +
    </button>
  )
}

function useKeyboardNavigation(
  idxs: number[],
  itemsPerPage: number,
  setOffset: React.Dispatch<React.SetStateAction<number>>
) {
  const sampleIdx = useCurrScene((s) => s.sampleIdx)
  const setSampleIdx = useCurrScene((s) => s.setSampleIdx)
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
  return (
    <div
      className={`w-full max-w-[380px] mx-auto flex justify-between items-center mt-2 pointer-events-auto`}
    >
      <button
        className={`px-4 py-2 ${isFirstPage ? "opacity-0" : ""}`}
        disabled={page === 0}
        onClick={() => setPage(Math.max(page - 1, 0))}
      >
        &lt; prev
      </button>
      <div className={totalPages <= 1 ? "hidden" : ""}>
        {page + 1}/{totalPages}
      </div>
      <button
        className={`px-4 py-2  ${isLastPage ? "opacity-0" : ""}`}
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

function SampleCanvas({
  sample,
  isCurrent,
}: {
  sample: SampleRaw
  isCurrent?: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const camProps = useCurrScene((s) => s.ds?.camProps)
  const aspectRatio = useCurrScene((s) => s.getAspectRatio())
  const hasCam = !!camProps
  const camProcessor = useCurrScene((s) => s.ds?.camProps?.processor)
  const inputDims = useCurrScene((s) => s.ds?.inputDims)
  useEffect(() => {
    const canvas = ref.current
    if (!inputDims || !sample || !canvas) return
    if (camProcessor === "handPose")
      drawHandPoseSampleToCanvas(sample, inputDims, canvas)
    else drawImageSampleToCanvas(sample, inputDims, canvas)
  }, [inputDims, sample, camProcessor])
  useEffect(() => {
    if (!isCurrent) return
    const el = ref.current
    el?.scrollIntoView({ behavior: "smooth" })
    return () => el?.parentElement?.blur()
  }, [isCurrent])
  return (
    <canvas
      className={`border-2 bg-blend-multiply ${
        isCurrent ? "border-accent" : "border-menu-border"
      } hover:border-marker rounded-md w-[var(--item-size)] ${
        hasCam ? "scale-x-[-1] bg-box" : ""
      } `}
      width={hasCam ? VIDEO_BASE_SIZE : inputDims?.[1]}
      height={hasCam ? VIDEO_BASE_SIZE / aspectRatio : inputDims?.[2]}
      ref={ref}
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
      tf.browser.toPixels(img, canvas)
    })
  } catch (e) {
    console.warn(e)
  }
}
