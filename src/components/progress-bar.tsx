import { useEffect, useRef, useState } from "react"

interface ProgressBarProps {
  percent?: number
  length?: number
}

export const ProgressBar = ({ percent, length }: ProgressBarProps) => {
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
  const isHidden = percent === undefined
  return (
    <div
      ref={wrapeprRef}
      className={`w-full overflow-hidden ${isHidden ? "opacity-0 h-0!" : ""}`}
    >
      <span ref={testRef} className="absolute opacity-0">
        █
      </span>
      {Array.from({ length: l }).map((_, i) => (
        <span key={i} style={{ width: pxPerChar + "px" }}>
          {(percent ?? 0) >= i / (l - 1) ? "█" : "░"}
        </span>
      ))}
    </div>
  )
}
