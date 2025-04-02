import { useEffect, useRef, useState } from "react"
import * as tf from "@tensorflow/tfjs"
import type { SampleRaw } from "@/data"
import { getSample } from "@/data/sample"
import { useCurrScene } from "@/store"
import { drawHandPoseSampleToCanvas } from "@/data/hand-pose"
import { useHasBlur } from "./status-bar"

export function SampleViewer() {
  const idxs = useCurrScene((s) => s.sampleViewerIdxs)
  const [offset, setOffset] = useState(0)
  const [samples, setSamples] = useState<SampleRaw[]>([])
  const ds = useCurrScene((s) => s.ds)
  const subset = useCurrScene((s) => s.subset)
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
  const hasCam = useCurrScene((s) => !!s.ds?.camProps)
  const hasBlur = useHasBlur()
  if (!samples.length) return null
  return (
    <div
      className={`-my-4 py-4! bg-gradient-to-b from-transparent via-[1rem] ${
        hasBlur ? "via-black to-black" : "via-background to-background"
      } transition-colors duration-300 w-screen bottom-0 right-0 xl:fixed xl:p-0 xl:m-0 xl:bg-none xl:w-auto xl:translate-x-0 xl:right-4 xl:top-[50vh] xl:-translate-y-[50%] [--item-size:70px] sm:[--item-size:80px] pointer-events-none`}
    >
      <div
        className={`xl:w-[calc(4*var(--item-size)+1.5rem)] ${
          hasCam ? "xl:aspect-[4/3]" : "xl:aspect-square"
        } flex justify-center items-start xl:justify-end`}
      >
        <div
          className={`flex items-start justify-start gap-2 overflow-auto no-scrollbar px-4 xl:justify-end xl:flex-wrap xl:px-0 mx-auto xl:mx-0 pointer-events-auto`}
        >
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
      className={`w-full max-w-[500px] mx-auto flex justify-between items-center mt-2 pointer-events-auto`}
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
  const aspectRatio = camProps?.aspectRatio || 4 / 3
  const hasCam = !!camProps
  const inputDims = useCurrScene((s) => s.ds?.inputDims)
  useEffect(() => {
    const canvas = ref.current
    if (!inputDims || !sample || !canvas) return
    if (hasCam) drawHandPoseSampleToCanvas(sample, inputDims, canvas)
    else drawImageSampleToCanvas(sample, inputDims, canvas)
  }, [inputDims, sample, hasCam])
  return (
    <canvas
      className={`border-1 bg-blend-multiply ${
        isCurrent ? "border-accent" : "border-menu-border"
      } rounded-md w-[var(--item-size)] ${
        hasCam ? "scale-x-[-1] bg-box" : ""
      } `}
      width={hasCam ? VIDEO_BASE_SIZE : inputDims?.[1]}
      height={hasCam ? (1 / aspectRatio) * VIDEO_BASE_SIZE : inputDims?.[2]}
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
