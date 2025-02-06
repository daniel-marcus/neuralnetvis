import { useCallback, useEffect, useRef } from "react"
import { useTabStore } from "../components/menu"
import { usePathname, useRouter } from "next/navigation"

interface BoxProps {
  children: React.ReactNode
  className?: string
  padding?: boolean
  hasBg?: boolean
}

export function Box({ children, className, padding, hasBg = true }: BoxProps) {
  const ref = useRef<HTMLDivElement>(null)
  const setIsShown = useTabStore((s) => s.setIsShown)
  const pathname = usePathname()
  const router = useRouter()
  const closeTab = useCallback(() => {
    const parentPath = pathname.split("/").slice(0, -1).join("/") || "/"
    setIsShown(false)
    router.push(parentPath)
  }, [setIsShown, pathname, router])
  useSwipeClose(ref, closeTab)
  return (
    <div
      ref={ref}
      className={`${padding ? "p-4" : ""} ${
        hasBg ? "bg-box-bg" : ""
      } rounded-box text-left shadow-sm translate-y-[var(--translate-y)] transition-translate duration-50 ease-in-out pointer-events-auto ${className}`}
    >
      {children}
    </div>
  )
}

const DELTA_THRESHOLD = -70 // swipe up
const VELOCITY_THRESHOLD = 0.5

function useSwipeClose(
  ref: React.RefObject<HTMLDivElement | null>,
  onClose: () => void
) {
  const offsetY = useRef(0)
  useEffect(() => {
    if (!ref.current) return
    const el = ref.current
    let startX: number | null = null
    let startY: number | null = null
    let deltaY = 0
    let startTime = 0
    let hasFired = false
    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      deltaY = 0
      startTime = Date.now()
    }
    const handleTouchMove = (e: TouchEvent) => {
      e.stopPropagation()
      e.preventDefault()
      if (startX === null || startY === null) return
      const deltaX = e.touches[0].clientX - startX
      deltaY = e.touches[0].clientY - startY
      const isVertial = Math.abs(deltaY) > Math.abs(deltaX)
      if (isVertial) {
        const newOffset = offsetY.current + deltaY
        el.style.setProperty("transition-duration", "0s")
        el.style.setProperty("--translate-y", `${Math.min(newOffset, 0)}px`)
        const velocity = Math.abs(deltaY) / (Date.now() - startTime)
        if (deltaY < DELTA_THRESHOLD && velocity > VELOCITY_THRESHOLD) {
          if (!hasFired) onClose()
          hasFired = true
        }
      }
    }
    const handleTouchEnd = () => {
      el.style.setProperty("transition-duration", null)
      if (hasFired) {
        offsetY.current = 0
        hasFired = false
        setTimeout(() => el?.style.setProperty("--translate-y", "0"), 300)
      } else {
        const newOffset = offsetY.current + deltaY
        offsetY.current = Math.min(newOffset, 0)
        el.style.setProperty("--translate-y", `${offsetY.current}px`)
      }
      startX = null
      startY = null
    }
    el.addEventListener("touchstart", handleTouchStart)
    el.addEventListener("touchmove", handleTouchMove)
    el.addEventListener("touchend", handleTouchEnd)
    return () => {
      el.removeEventListener("touchstart", handleTouchStart)
      el.removeEventListener("touchmove", handleTouchMove)
      el.removeEventListener("touchend", handleTouchEnd)
    }
  }, [ref, onClose])
}
