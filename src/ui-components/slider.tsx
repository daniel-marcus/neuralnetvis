import { useDrag } from "@use-gesture/react"
import { useEffect, useRef, useState } from "react"

interface SliderProps {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  step?: number
  showValue?: boolean
  lazyUpdate?: boolean
  // isOptiona?: boolean
}

export const Slider = ({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  showValue,
  lazyUpdate,
}: SliderProps) => {
  const sliderRef = useRef<HTMLDivElement>(null)

  const [currVal, setCurrVal] = useState(value)
  useEffect(() => {
    setCurrVal(value)
  }, [value])

  // TODO: add spring (e.g. when space between options is big as with validationSplit)
  const bind = useDrag(({ event, active, xy: [clientX] }) => {
    if (sliderRef.current) {
      event.stopPropagation()
      const rect = sliderRef.current.getBoundingClientRect()
      const percentage = (clientX - rect.left) / rect.width
      const newValue =
        Math.round((percentage * (max - min) + min) * (1 / step)) / (1 / step)
      const clampedValue = Math.min(Math.max(newValue, min), max)
      setCurrVal(clampedValue)
      if (lazyUpdate && active) return
      else onChange?.(clampedValue)
    }
  })

  const bgContent = "░".repeat(100)
  const percent = ((currVal - min) / (max - min)) * 100

  return (
    <div className="flex gap-2">
      <div
        ref={sliderRef}
        {...bind()}
        className="flex-1 overflow-hidden select-none relative cursor-pointer touch-none"
        aria-label={`${value}/${max}`}
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
      {!!showValue && ( // maybe use input?
        <div className="flex-none w-[2.5em] text-right">{currVal}</div>
      )}
    </div>
  )
}
