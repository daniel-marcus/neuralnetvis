import { useCallback, useEffect } from "react"
import { useTabStore } from "../components/menu"
import { useDrag } from "@use-gesture/react"
import { useSpring, animated } from "@react-spring/web"

const AnimatedDiv = animated("div")

interface BoxProps {
  children: React.ReactNode
  className?: string
  padding?: boolean
  hasBg?: boolean
}

export function Box({ children, className, padding, hasBg = true }: BoxProps) {
  const isShown = useTabStore((s) => s.isShown)
  const setIsShown = useTabStore((s) => s.setIsShown)
  const closeTab = useCallback(() => {
    setIsShown(false)
    // const parentPath = pathname.split("/").slice(0, -1).join("/") || "/"
    // router.push(parentPath)
  }, [setIsShown])
  const [bind, style] = useSwipeClose(closeTab, isShown)
  return (
    <AnimatedDiv
      {...bind()}
      className={`${padding ? "p-4" : ""} ${
        hasBg ? "bg-box-bg" : ""
      } rounded-box text-left shadow-sm translate-y-[var(--translate-y)] transition-translate duration-50 ease-in-out pointer-events-auto touch-none ${className}`}
      style={style}
    >
      {children}
    </AnimatedDiv>
  )
}

const DELTA_THRESHOLD = -70 // swipe up
const VELOCITY_THRESHOLD = 0.5

function useSwipeClose(onClose: () => void, isShown: boolean) {
  const [{ y }, api] = useSpring(() => ({ y: 0 }))
  useEffect(() => {
    api.start({ y: 0 })
  }, [isShown, api])
  const bind = useDrag(
    ({
      event,
      offset: [, oy],
      movement: [, my],
      velocity: [, vy],
      down,
      first,
    }) => {
      if (!("pointerType" in event) || event.pointerType === "mouse") return
      const newY = first ? y.get() : oy
      api.start({ y: newY, immediate: down })
      if (my < DELTA_THRESHOLD && vy > VELOCITY_THRESHOLD) {
        onClose()
      }
    },
    {
      from: () => [0, y.get()],
      bounds: { bottom: 0 },
      rubberband: [0, 0.1],
      filterTaps: true,
    }
  )
  const style = {
    transform: y.to((v) => `translateY(${v}px)`),
  }
  return [bind, style] as const
}
