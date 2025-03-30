import { useEffect, useRef, useState } from "react"
import * as tf from "@tensorflow/tfjs"
import type { SampleRaw } from "@/data"
import { getSample } from "@/data/sample"
import { useSceneStore } from "@/store"
import { drawHandPoseSampleToCanvas } from "@/data/hand-pose"
import { useIsScreen } from "@/utils/screen"

export function SampleViewer() {
  const idxs = useSceneStore((s) => s.sampleViewerIdxs)
  const [offset, setOffset] = useState(0)
  const [samples, setSamples] = useState<SampleRaw[]>([])
  const ds = useSceneStore((s) => s.ds)
  const subset = useSceneStore((s) => s.subset)
  const isScreenXl = useIsScreen("xl")
  const itemsPerPage = isScreenXl ? 16 : 4
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
  const hasCam = useSceneStore((s) => s.ds?.hasCam)
  return (
    <div className="w-[calc(4*var(--item-size)+2rem)] fixed bottom-4 right-[50vw] translate-x-[50%] xl:translate-x-0 xl:right-4 xl:top-[50vh] xl:-translate-y-[50%] [--item-size:70px] sm:[--item-size:80px] pointer-events-auto">
      <div
        className={`w-full ${hasCam ? "xl:aspect-[4/3]" : "xl:aspect-square"} `}
      >
        <div
          className={`flex items-start justify-center xl:justify-end gap-2 flex-wrap`}
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
    <div className="w-full flex justify-between items-center mt-2">
      <button
        className={`p-2 ${isFirstPage ? "opacity-0" : ""}`}
        disabled={page === 0}
        onClick={() => setPage(Math.max(page - 1, 0))}
      >
        &lt; prev
      </button>
      <div className={totalPages <= 1 ? "hidden" : ""}>
        {page + 1}/{totalPages}
      </div>
      <button
        className={`p-2 ${isLastPage ? "opacity-0" : ""}`}
        disabled={isLastPage}
        onClick={() => setPage(Math.min(page + 1, totalPages - 1))}
      >
        next &gt;
      </button>
    </div>
  )
}

type ImgShape = [number, number, number]

function SampleCanvas({
  sample,
  isCurrent,
}: {
  sample: SampleRaw
  isCurrent?: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const hasCam = useSceneStore((s) => s.ds?.hasCam)
  const inputDims = useSceneStore((s) => s.ds?.inputDims)
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
      width={hasCam ? 640 : inputDims?.[1]}
      height={hasCam ? 480 : inputDims?.[2]}
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
