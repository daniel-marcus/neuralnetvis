import { useEffect } from "react"
import throttle from "lodash.throttle"
import { useInView } from "@/utils/screen"
import type { ScrollBlockProps } from "./types"
import { interpolateCamera } from "@/scene-views/3d-model/utils"

export function Block(props: ScrollBlockProps) {
  const { children, className, ...scrollProps } = props
  const [ref, inView] = useScrollCallbacks(scrollProps)
  return (
    <div
      ref={ref}
      className={`min-h-[50dvh] pb-16 ${
        inView ? "opacity-100 " : "opacity-30"
      } transition-opacity duration-100 ${className ?? ""}`}
    >
      {children}
    </div>
  )
}

export function useScrollCallbacks(scrollProps: ScrollBlockProps) {
  const { onScroll, onEnter, onLeave } = scrollProps
  const { cameraPos, nextProps } = scrollProps
  const [ref, inView] = useInView({ rootMargin: "-50% 0px" })

  useEffect(() => {
    if (!inView) return
    const onScrollCb = () => {
      if (!ref.current) return
      const percent = calculateScrolledPercent(ref)
      const nextCameraPos = nextProps?.cameraPos

      if (cameraPos && nextCameraPos) {
        interpolateCamera(cameraPos, nextCameraPos, percent)
      }

      onScroll?.({ percent })
    }
    const throttledOnScrollCb = throttle(onScrollCb, 10)
    window.addEventListener("scroll", throttledOnScrollCb)
    return () => window.removeEventListener("scroll", throttledOnScrollCb)
  }, [inView, onScroll, ref, cameraPos, nextProps])

  useEffect(() => {
    if (!onEnter && !onLeave) return
    if (!inView) return
    if (onEnter) onEnter()
    return () => {
      if (onLeave) onLeave()
    }
  }, [inView, onEnter, onLeave])

  return [ref, inView] as const
}

function calculateScrolledPercent(
  ref: React.RefObject<HTMLElement | null>
): number {
  if (!ref.current) return 0
  const rect = ref.current.getBoundingClientRect()
  const windowHeight = window.innerHeight
  const middleY = windowHeight / 2
  if (rect.bottom <= middleY) return 1
  if (rect.top >= middleY) return 0
  const isFirst = ref.current === ref.current.parentElement?.firstElementChild
  const offset = isFirst
    ? rect.top + document.scrollingElement!.scrollTop - middleY
    : 0
  const percent =
    Math.round(
      ((middleY + offset - rect.top) / (rect.height + offset)) * 1000
    ) / 1000
  return percent
}
