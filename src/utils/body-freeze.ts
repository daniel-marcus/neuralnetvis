import { useEffect } from "react"

// prevents body scroll with scrollable modal open to keep iOS Safari address bar hidden

export function useBodyFreeze(
  isActive: boolean,
  scrollableRef: React.RefObject<HTMLElement | null>
) {
  useEffect(() => {
    const el = scrollableRef.current
    if (!isActive || !el) return
    let _startY = 0
    const getStartY = (e: TouchEvent) => (_startY = e.targetTouches[0].clientY)
    const preventOverscroll = (e: TouchEvent) => {
      const deltaY = e.targetTouches[0].clientY - _startY
      if (el.scrollTop === 0 && deltaY > 0) e.preventDefault()
    }
    document.body.classList.add("overflow-hidden")
    el.addEventListener("touchstart", getStartY)
    el.addEventListener("touchmove", preventOverscroll)
    return () => {
      document.body.classList.remove("overflow-hidden")
      el.removeEventListener("touchstart", getStartY)
      el.removeEventListener("touchmove", preventOverscroll)
    }
  }, [isActive, scrollableRef])
}
