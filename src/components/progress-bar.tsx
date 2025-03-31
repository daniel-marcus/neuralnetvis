import { useEffect, useRef, useState, RefObject, memo } from "react"
import { useGlobalStore } from "@/store"

export const ProgressBar = memo(function ProgressBar() {
  const percent = useGlobalStore((s) => s.status.getPercent())
  const wrapperRef = useRef<HTMLDivElement>(null)
  const testRef = useRef<HTMLSpanElement>(null)
  const [wrapperWidth, pxPerChar] = useResponsiveSize(wrapperRef, testRef)
  const length = Math.ceil(wrapperWidth / pxPerChar)
  const isSpinner = percent === -1
  const isHidden = percent === null
  return (
    <div
      ref={wrapperRef}
      className={`w-full bg-red leading-none overflow-hidden transition-all duration-300 ${
        isHidden ? "opacity-0" : ""
      } relative z-30 [--px-per-char:]`}
    >
      <span
        ref={testRef}
        className={`absolute ${
          isSpinner ? "animate-move-left-right text-marker" : "opacity-0"
        }`}
      >
        █
      </span>
      <div>
        {Array.from({ length }).map((_, i) => {
          const checked = (percent ?? 0) >= i / (length - 1)
          return (
            <span key={i} className={checked ? "text-marker" : ""}>
              {checked ? "█" : "░"}
            </span>
          )
        })}
      </div>
    </div>
  )
})

function useResponsiveSize(
  wrapperRef: RefObject<HTMLDivElement | null>,
  testRef: RefObject<HTMLSpanElement | null>
) {
  const [wrapperWidth, setWrapperWidth] = useState(0)
  const [pxPerChar, setPxPerChar] = useState(10)
  useEffect(() => {
    const handleResize = () => {
      if (wrapperRef.current) setWrapperWidth(wrapperRef.current.clientWidth)
      if (testRef.current)
        setPxPerChar(testRef.current.getBoundingClientRect().width)
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [wrapperRef, testRef])
  return [wrapperWidth, pxPerChar] as const
}
