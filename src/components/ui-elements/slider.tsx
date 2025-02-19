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
  transform?: (v: number) => number
  markers?: number[]
  yPad?: number // in "em". increases touchable are, helpful for mobile
}

export const Slider = ({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  showValue,
  lazyUpdate,
  transform,
  markers = [],
  yPad = 0,
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
      else onChange?.(transform?.(clampedValue) ?? clampedValue)
    }
  })

  const bgContent = "░".repeat(100)
  const getPercent = (val: number) => ((val - min) / (max - min)) * 100
  const currPercent = getPercent(currVal)

  return (
    <div
      className="flex gap-2"
      style={
        {
          "--y-pad": `${yPad}em`,
        } as React.CSSProperties
      }
    >
      <div
        ref={sliderRef}
        {...bind()}
        className="flex-1 py-[var(--y-pad)] overflow-hidden select-none relative cursor-pointer touch-none"
        aria-label={`${value}/${max}`}
      >
        {bgContent}
        {markers.map((mVal, i) => (
          <span
            key={i}
            className="absolute top-[var(--y-pad)] left-0"
            style={{
              left: `${getPercent(mVal)}%`,
              transform: `translateX(-${getPercent(mVal)}%)`,
            }}
          >
            |
          </span>
        ))}
        <span
          className={`absolute top-[var(--y-pad)] left-0 text-accent`}
          style={{
            left: `${currPercent}%`,
            transform: `translateX(-${currPercent}%)`,
          }}
        >
          █
        </span>
      </div>
      {!!showValue && ( // maybe use input?
        <div className="flex-none w-[2.5em] text-right">
          {transform?.(currVal) ?? currVal}
        </div>
      )}
    </div>
  )
}
