import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as tf from "@tensorflow/tfjs"
import throttle from "lodash.throttle"
import { getSample } from "@/data/sample"
import { getSeqPosition } from "@/data/next-token"
import { useCurrScene, useSceneStore } from "@/store"
import { drawHandPoseSampleToCanvas } from "@/data/hand-pose"
import { useKeyCommand } from "@/utils/key-command"
import { useHasStatusOrSelected } from "./sample-slider"
import { Slider } from "@/components/ui-elements"
import { CustomBtns } from "./sample-viewer-btns"
import { ClientOnly, useIsIntro } from "@/utils/helpers"
import type { SampleRaw } from "@/data"

const throttledScrollTo = throttle((el: Element | null, left: number) => el?.scrollTo({ left }), 50)

const ITEM_SIZE = 70 // --item-size
const ITEM_WIDTH = ITEM_SIZE + 8 // + 0.5rem
const BUFFER_SIZE = 3 // items before/after visible items to preload
const DEFAULT_WIDTH = 600
const FOLLOW_TAU = 50 // ms, time constant for following the current sample

interface VisibleSample {
  sampleIdx: number
  offsetLeft: number
}

function SampleViewer_() {
  const idxs = useSceneStore((s) => s.sampleViewerIdxs)
  const ds = useSceneStore((s) => s.ds)

  const sampleIdx = useSceneStore((s) => s.sampleIdx)
  const setSampleIdx = useSceneStore((s) => s.setSampleIdx)

  const isEvaluationView = useCurrScene((s) => s.view === "evaluation")
  const hasSample = useCurrScene((s) => s.sampleIdx !== undefined)
  const hasDarkBg = isEvaluationView && !hasSample

  const isLayersView = useSceneStore((s) => s.view === "layers")
  const camAspectRatio = useSceneStore((s) => s.getAspectRatio())
  const aspectRatio = ds?.camProps ? camAspectRatio : 1

  const totalWidth = idxs.length ? idxs.length * ITEM_WIDTH - 8 : 0 // -0.5rem margin for last item
  const scrollElRef = useRef<HTMLDivElement>(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [containerWidth, setContainerWidth] = useState(DEFAULT_WIDTH)

  const visibleStart = useMemo(
    () => Math.max(0, Math.floor(scrollLeft / ITEM_WIDTH) - BUFFER_SIZE),
    [scrollLeft],
  )
  const visibleEnd = useMemo(
    () =>
      Math.min(idxs.length, Math.ceil((scrollLeft + containerWidth) / ITEM_WIDTH) + BUFFER_SIZE),
    [scrollLeft, containerWidth, idxs],
  )
  const visibleSamples: VisibleSample[] = useMemo(() => {
    return idxs.slice(visibleStart, visibleEnd).map((idx, idxInSlice) => ({
      sampleIdx: idx,
      offsetLeft: (visibleStart + idxInSlice) * ITEM_WIDTH,
    }))
  }, [visibleStart, visibleEnd, idxs])
  useEffect(() => {
    const handleResize = () => {
      setContainerWidth(scrollElRef.current?.clientWidth ?? DEFAULT_WIDTH)
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])
  useEffect(() => {
    scrollElRef.current?.scrollTo({ left: 0, behavior: "smooth" })
  }, [idxs])
  const followRef = useRef(0) // animation frame id
  useEffect(() => {
    // follow the current sample; runs after the reset above, so it wins if the sample is in idxs
    const el = scrollElRef.current
    if (!el) return
    const localIdx = sampleIdx === undefined ? -1 : idxs.indexOf(sampleIdx)
    if (localIdx < 0) return
    const centered = localIdx * ITEM_WIDTH - (containerWidth - ITEM_SIZE) / 2
    const left = Math.max(0, Math.min(centered, el.scrollWidth - el.clientWidth))
    cancelAnimationFrame(followRef.current)
    if (Math.abs(left - el.scrollLeft) > containerWidth * 2) {
      el.scrollTo({ left, behavior: "instant" }) // far jump
      return
    }
    // eased & retargetable: native smooth scrolling lags when holding an arrow key, instant
    // scrolling by exactly one item per key repeat looks like repeated samples (afterimages)
    let pos = el.scrollLeft
    let prevTime = performance.now()
    const step = (time: number) => {
      const dt = Math.max(0, time - prevTime)
      prevTime = time
      pos += (left - pos) * (1 - Math.exp(-dt / FOLLOW_TAU))
      const isDone = Math.abs(left - pos) < 0.5
      el.scrollLeft = isDone ? left : pos
      if (!isDone) followRef.current = requestAnimationFrame(step)
    }
    followRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(followRef.current)
  }, [sampleIdx, idxs, containerWidth])
  const cancelFollow = useCallback(() => cancelAnimationFrame(followRef.current), [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleScroll = useCallback(
    // eslint-disable-next-line react-hooks/use-memo
    throttle((e: React.UIEvent<HTMLDivElement>) => {
      if (e.target instanceof HTMLDivElement) setScrollLeft(e.target.scrollLeft)
    }, 50),
    [],
  )

  const handleSliderChange = useCallback(
    (newVal: number) => {
      cancelFollow()
      throttledScrollTo(scrollElRef.current, newVal)
    },
    [cancelFollow],
  )

  const atStart = scrollLeft <= 0
  const atEnd = scrollLeft >= totalWidth - containerWidth

  const hasStatusOrSelected = useHasStatusOrSelected()
  const isIntro = useIsIntro(idxs)

  useKeyboardNavigation(idxs)

  if (!idxs.length && !isLayersView) return null
  // auto-hide: only the label stays in the viewport, hover reveals the samples
  return (
    <div
      className={`fixed bottom-0 right-0 z-[-1] -mb-4! bg-linear-to-b from-transparent ${
        hasDarkBg ? "via-[1rem] via-black to-black" : "to-background"
      } transition-discrete duration-300 w-screen [--item-size:70px] pointer-events-none ${
        isIntro
          ? ""
          : "translate-y-[calc(100%-5rem)] has-[>div:hover]:translate-y-0 [@media(hover:none)]:has-[>div:focus-within]:translate-y-0"
      } ${hasStatusOrSelected ? "opacity-0 lg:opacity-100" : ""}`}
      style={{ "--item-aspect-ratio": aspectRatio } as React.CSSProperties}
    >
      <div
        tabIndex={-1} // touch: tap to reveal, tap outside to tuck away
        data-intro={isIntro || undefined}
        className={`group/sample-viewer max-w-screen sm:max-w-150 mx-auto pt-4 pb-8 outline-none ${
          hasStatusOrSelected ? "pointer-events-none lg:pointer-events-auto" : "pointer-events-auto"
        } ${isIntro ? "" : "[@media(hover:none)]:not-focus-within:*:pointer-events-none"}`}
      >
        <div className="flex items-center justify-center pb-2">samples</div>
        <div className="opacity-0 transition-opacity duration-300 group-data-intro/sample-viewer:opacity-100 group-hover/sample-viewer:opacity-100 [@media(hover:none)]:group-focus-within/sample-viewer:opacity-100">
          <div className="relative flex gap-2">
            {isLayersView && <CustomBtns />}
            <div
              className={`overflow-auto no-scrollbar grow`}
              ref={scrollElRef}
              onScroll={handleScroll}
              onWheel={cancelFollow}
              onTouchStart={cancelFollow}
              style={getMaskStyle(atStart, atEnd)}
            >
              <div
                className={`mx-auto relative h-[calc(var(--item-size)/var(--item-aspect-ratio))] pointer-events-auto`}
                style={{
                  width: `${totalWidth}px`,
                }}
              >
                {visibleSamples.map((vs) => {
                  const isCurrent = vs.sampleIdx === sampleIdx
                  return (
                    <button
                      key={vs.sampleIdx}
                      className="absolute"
                      style={{ left: `${vs.offsetLeft}px` }}
                      onClick={() => setSampleIdx(isCurrent ? undefined : vs.sampleIdx)}
                    >
                      <SamplePreview sampleIdx={vs.sampleIdx} isCurrent={isCurrent} />
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <div
            className={`py-2 ${
              totalWidth <= containerWidth
                ? "opacity-0"
                : "opacity-50 sm:opacity-30 hover:opacity-100"
            } transition-opacity duration-200 w-full`}
          >
            <Slider
              value={scrollLeft}
              min={0}
              max={totalWidth - containerWidth}
              onChange={handleSliderChange}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export const SampleViewer = () => (
  <ClientOnly>
    <SampleViewer_ />
  </ClientOnly>
)

const getMaskStyle = (atStart: boolean, atEnd: boolean) => {
  const fadeWidth = "10%"

  let maskImage

  if (atStart && atEnd) {
    // Content fits entirely, no mask needed
    maskImage = "none"
  } else if (atStart) {
    // Only fade right edge
    maskImage = `linear-gradient(to right, black calc(100% - ${fadeWidth}), transparent 100%)`
  } else if (atEnd) {
    // Only fade left edge
    maskImage = `linear-gradient(to right, transparent 0%, black ${fadeWidth})`
  } else {
    // Fade both edges
    maskImage = `linear-gradient(to right, transparent 0%, black ${fadeWidth}, black calc(100% - ${fadeWidth}), transparent 100%)`
  }

  return {
    WebkitMask: maskImage,
    mask: maskImage,
  }
}

function useKeyboardNavigation(idxs: number[]) {
  const setSampleIdx = useSceneStore((s) => s.setSampleIdx)
  const nextLocal = useCallback(
    (step = 1) =>
      setSampleIdx((prevIdx) => {
        const currLocalIdx = typeof prevIdx === "number" ? idxs.indexOf(prevIdx) : -1
        return idxs[currLocalIdx + step]
      }),
    [idxs, setSampleIdx],
  )
  const prev = useCallback(() => nextLocal(-1), [nextLocal])
  const next = useCallback(() => nextLocal(1), [nextLocal])
  useKeyCommand("ArrowLeft", prev, !!idxs.length, true)
  useKeyCommand("ArrowRight", next, !!idxs.length, true)
}

type ImgShape = [number, number, number]

const VIDEO_BASE_SIZE = 640 // x 480 -> 4:3 aspect ratio

interface SamplePreviewProps {
  sampleIdx: number
  isCurrent?: boolean
}

function useSample(sampleIdx: number) {
  const [sample, setSample] = useState<SampleRaw | null>(null)
  const ds = useSceneStore((s) => s.ds)
  const subset = useSceneStore((s) => s.subset)
  useEffect(() => {
    async function loadSample() {
      if (!ds) return
      await new Promise((res) => setTimeout(res, 0))
      const newSample = await getSample(ds, subset, sampleIdx)
      if (newSample) setSample(newSample)
    }
    loadSample()
  }, [sampleIdx, ds, subset])
  return sample
}

function SamplePreview({ sampleIdx, isCurrent }: SamplePreviewProps) {
  const sample = useSample(sampleIdx)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!isCurrent) return
    const el = ref.current
    return () => el?.parentElement?.blur()
  }, [isCurrent])
  const isTextSample = useSceneStore((s) => !!s.ds?.tokenizer)
  const Preview = isTextSample ? TokenPreview : CanvasPreview
  return (
    <div
      className={`border-2 ${
        isCurrent ? "border-accent" : "border-menu-border"
      } hover:border-marker rounded-md overflow-hidden w-(--item-size) aspect-(--item-aspect-ratio) ${
        !sample ? "bg-menu-border" : ""
      }`}
      ref={ref}
    >
      {!!sample && <Preview sample={sample} />}
    </div>
  )
}

interface PreviewProps {
  sample: SampleRaw
}

function TokenPreview({ sample }: PreviewProps) {
  const tokenizer = useSceneStore((s) => s.ds?.tokenizer)
  const text = useMemo(() => {
    if (!tokenizer || !sample.X) return ""
    const end = getSeqPosition(sample.X, tokenizer) + 1 // without padding
    const tokens = [...sample.X].slice(1, Math.min(end, 31)).map(tokenizer.decode)
    return tokens.join(" ") // using non-breaking space to allow arbitrary line breaks
  }, [sample.X, tokenizer])
  return (
    <div className="text-[9px] w-full h-(--item-size) text-left wrap-break-word leading-none">
      {text}
    </div>
  )
}

function CanvasPreview({ sample }: PreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const camProps = useSceneStore((s) => s.ds?.camProps)
  const aspectRatio = useSceneStore((s) => s.getAspectRatio())
  const hasCam = !!camProps
  const camProcessor = useSceneStore((s) => s.ds?.camProps?.processor)
  const inputDims = useSceneStore((s) => s.ds?.inputDims)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!inputDims || !sample || !canvas) return
    if (camProcessor === "handPose") drawHandPoseSampleToCanvas(sample, inputDims, canvas)
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
  canvas: HTMLCanvasElement,
) {
  try {
    tf.tidy(() => {
      const img = tf.tensor(sample.X, inputDims as ImgShape, "int32") as tf.Tensor3D
      const backend = tf.getBackend()
      const draw = backend === "wasm" ? tf.browser.toPixels : tf.browser.draw
      draw(img, canvas)
    })
  } catch (e) {
    console.warn(e)
  }
}
