import { useEffect, useRef, useState } from "react"
import * as tf from "@tensorflow/tfjs"
import type { SampleRaw } from "@/data"
import { getSample } from "@/data/sample"
import { useSceneStore } from "@/store"

const SAMPLES_PER_PAGE = 16

export function SampleViewer() {
  const idxs = useSceneStore((s) => s.sampleViewerIdxs)
  const [page, setPage] = useState(0)
  const [samples, setSamples] = useState<SampleRaw[]>([])
  const ds = useSceneStore((s) => s.ds)
  const subset = useSceneStore((s) => s.subset)
  useEffect(() => {
    setPage(0)
    setSamples([])
  }, [idxs])
  useEffect(() => {
    async function getSamples() {
      if (!ds) return
      const newSamples: SampleRaw[] = []
      const offset = page * SAMPLES_PER_PAGE
      for (const idx of idxs.slice(offset, offset + SAMPLES_PER_PAGE)) {
        const sample = await getSample(ds, subset, idx)
        if (sample) newSamples.push(sample)
      }
      setSamples(newSamples)
    }
    getSamples()
  }, [idxs, ds, subset, page])
  const sampleIdx = useSceneStore((s) => s.sampleIdx)
  const setSampleIdx = useSceneStore((s) => s.setSampleIdx)
  return (
    <div className="max-w-[calc(5*var(--item-size)+2rem)] mx-auto mt-8 xl:m-0 xl:max-w-none xl:fixed xl:right-0 xl:top-[50vh] xl:-translate-y-[50%] xl:p-4 [--item-size:70px] pointer-events-auto">
      <div className="xl:w-[calc(4*var(--item-size)+1.5rem)] xl:aspect-square">
        <div className="flex items-start justify-center xl:justify-end gap-2 flex-wrap">
          {samples.map((sample, i) => {
            const idx = idxs[page * SAMPLES_PER_PAGE + i]
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
        itemsPerPage={SAMPLES_PER_PAGE}
        page={page}
        setPage={setPage}
      />
    </div>
  )
}

interface PaginationProps {
  total: number
  itemsPerPage: number
  page: number
  setPage: React.Dispatch<React.SetStateAction<number>>
}

function Pagination({ total, itemsPerPage, page, setPage }: PaginationProps) {
  const totalPages = Math.ceil(total / itemsPerPage)
  const isFirstPage = page === 0
  const isLastPage = page === totalPages - 1 || totalPages === 0
  return (
    <div className="w-full flex justify-between items-center mt-2">
      <button
        className={`p-2 ${isFirstPage ? "opacity-0" : ""}`}
        disabled={page === 0}
        onClick={() => setPage((p) => Math.max(p - 1, 0))}
      >
        &lt; prev
      </button>
      <div className={totalPages <= 1 ? "hidden" : ""}>
        {page + 1}/{totalPages}
      </div>
      <button
        className={`p-2 ${isLastPage ? "opacity-0" : ""}`}
        disabled={isLastPage}
        onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
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
  const inputDims = useSceneStore((s) => s.ds?.inputDims)
  useEffect(() => {
    if (!inputDims || !sample) return
    try {
      tf.tidy(() => {
        const canvas = ref.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return
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
  }, [inputDims, sample])
  return (
    <canvas
      className={`border-1 bg-blend-multiply ${
        isCurrent ? "border-accent" : "border-menu-border"
      } rounded-md w-[var(--item-size)] h-[var(--item-size)]`}
      width={inputDims?.[1]}
      height={inputDims?.[2]}
      ref={ref}
    />
  )
}
