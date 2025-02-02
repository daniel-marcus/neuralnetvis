import { useDrag } from "@use-gesture/react"
import { useRef } from "react"

interface SliderProps {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  step?: number
}

export const Slider = ({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
}: SliderProps) => {
  const sliderRef = useRef<HTMLDivElement>(null)

  const bind = useDrag(({ xy: [clientX] }) => {
    if (sliderRef.current) {
      if (sliderRef.current) {
        const rect = sliderRef.current.getBoundingClientRect()
        const percentage = (clientX - rect.left) / rect.width
        const newValue =
          Math.round((percentage * (max - min) + min) / step) * step
        const clampedValue = Math.min(Math.max(newValue, min), max)
        onChange?.(clampedValue)
      }
    }
  })

  const bgContent = "░".repeat(100)
  const percent = ((value - min) / (max - min)) * 100

  return (
    <div
      ref={sliderRef}
      {...bind()}
      className="overflow-hidden select-none relative text-base touch-none"
    >
      <span
        className={`absolute top-0 left-0 text-accent`}
        style={{
          left: `${percent}%`,
          transform: `translateX(-${percent}%)`,
        }}
      >
        █
      </span>
      {bgContent}
    </div>
  )
}
