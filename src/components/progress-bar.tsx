import { useEffect, useRef, useState } from "react"
import { useStatusText } from "./status"

interface ProgressBarProps {
  length?: number
  isSpinner?: boolean
}

export const ProgressBar = ({ length, isSpinner }: ProgressBarProps) => {
  const percent = useStatusText((s) => s.percent)
  const wrapeprRef = useRef<HTMLDivElement>(null)
  const testRef = useRef<HTMLSpanElement>(null)
  const [wrapperWidth, setWrapperWidth] = useState(0)
  const [pxPerChar, setPxPerChar] = useState(10)
  useEffect(() => {
    const handleResize = () => {
      if (wrapeprRef.current) setWrapperWidth(wrapeprRef.current.clientWidth)
      if (testRef.current)
        setPxPerChar(testRef.current.getBoundingClientRect().width)
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])
  const maxLength = Math.ceil(wrapperWidth / pxPerChar)
  const l = length ? Math.min(length, maxLength) : maxLength
  const isHidden = percent === undefined && !isSpinner
  return (
    <div
      ref={wrapeprRef}
      className={`relative w-full overflow-hidden transition-opacity duration-150 ${
        isHidden ? "opacity-0 h-0!" : ""
      }`}
    >
      <span
        ref={testRef}
        className={`${
          isSpinner ? "absolute animate-move-left-right" : "absolute opacity-0"
        }`}
      >
        █
      </span>
      <div className={isSpinner ? "opacity-0" : ""}>
        {Array.from({ length: l }).map((_, i) => (
          <span key={i} style={{ width: pxPerChar + "px" }}>
            {(percent ?? 0) >= i / (l - 1) ? "█" : "░"}
          </span>
        ))}
      </div>
    </div>
  )
}
