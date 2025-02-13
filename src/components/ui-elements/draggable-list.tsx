import { ReactElement, useEffect, useMemo } from "react"
import { useSprings, animated } from "@react-spring/web"
import { rubberbandIfOutOfBounds, useDrag } from "@use-gesture/react"

// reference: https://codesandbox.io/p/sandbox/zfy9p

const AnimatedDiv = animated("div")

interface DraggableListProps {
  children: ReactElement[]
  onOrderChange: (newOrder: number[]) => void
  checkValidChange?: (newOrder: number[]) => boolean
  rowHeight: number
}

export const DraggableList = ({
  children,
  onOrderChange,
  checkValidChange,
  rowHeight,
}: DraggableListProps) => {
  const order = useMemo(() => children.map((_, i) => i), [children])

  const maxHeight = children.length * rowHeight

  const [springs, api] = useSprings(children.length, fn(order), [])
  useEffect(() => {
    if (!api) return
    api.start((i) => ({
      y: order.indexOf(i) * rowHeight,
      scale: 1,
      immediate: true,
    }))
  }, [api, order, rowHeight])

  const bind = useDrag(({ args: [originalIdx], active, movement: [, y] }) => {
    const currIdx = order.indexOf(originalIdx)
    const dragY = currIdx * rowHeight + y
    const currRow = clamp(Math.round(dragY / rowHeight), 0, children.length - 1)
    const newOrder = swap(order, currIdx, currRow)
    const isValidChange = checkValidChange ? checkValidChange(newOrder) : true
    if (isValidChange) {
      const min = -currIdx * rowHeight
      const max = maxHeight - currIdx * rowHeight - rowHeight
      const constrainedY = rubberbandIfOutOfBounds(y, min, max)
      api.start(
        fn(newOrder, active, originalIdx, currIdx, constrainedY, rowHeight)
      )
    }
    if (!active) {
      if (isValidChange && currRow !== currIdx) onOrderChange(newOrder)
      else api.start(fn(order, false, originalIdx, currIdx, y, rowHeight))
    }
  })

  return (
    <div
      className="relative h-[var(--height)]"
      style={
        {
          "--height": `${maxHeight}px`,
        } as React.CSSProperties
      }
    >
      {springs.map(({ y, scale, zIndex, cursor }, i) => {
        const child = children[i]
        return (
          <AnimatedDiv
            key={child.key ?? i}
            className="absolute top-0 w-full touch-none"
            {...bind(i)}
            style={{
              zIndex,
              y,
              scale,
              cursor,
            }}
          >
            {child}
          </AnimatedDiv>
        )
      })}
    </div>
  )
}

function fn(
  order: number[],
  active = false,
  originalIdx = 0,
  currIdx = 0,
  y = 0,
  rowHeight = 0
) {
  return (index: number) =>
    active && index === originalIdx
      ? {
          y: currIdx * rowHeight + y,
          scale: 1.03,
          zIndex: 1,
          immediate: (key: string) => key === "y" || key === "zIndex",
          cursor: "grabbing",
        }
      : {
          y: order.indexOf(index) * rowHeight,
          scale: 1,
          zIndex: 0,
          immediate: false,
          cursor: "grab",
        }
}

function swap<T>(array: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) return array

  const newArray = [...array]
  const [removed] = newArray.splice(fromIndex, 1)
  newArray.splice(toIndex, 0, removed)

  return newArray
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
