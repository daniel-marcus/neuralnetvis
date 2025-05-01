import { useEffect, useState, useRef, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { useGlobalStore, useSceneStore } from "@/store"
import { getTileDuration, type Section } from "@/components/tile-grid"
import { useBodyFreeze } from "@/utils/body-freeze"
import { lessonOverlayPortal } from "@/components/lesson"

type SceneOverlayProps = {
  children: ReactNode
  section: Section
}

export const SceneOverlay = ({ children, section }: SceneOverlayProps) => {
  const isActive = useSceneStore((s) => s.isActive)
  const [localActive, setLocalActive] = useState(isActive)
  useEffect(() => {
    if (!isActive) return
    if (section === "learn") window.scrollTo({ top: 0, behavior: "smooth" })
    setTimeout(() => setLocalActive(true), getTileDuration())
    return () => {
      window.scrollTo({ top: useGlobalStore.getState().scrollPos })
      setLocalActive(false)
    }
  }, [isActive, section])
  const ref = useRef<HTMLDivElement>(null)
  useBodyFreeze(section === "play" && isActive, ref)
  useIsScrolledBodyClass(ref, "overlay-scrolled")
  const view = useSceneStore((s) => s.view)
  const hasSample = useSceneStore((s) => typeof s.sampleIdx === "number")
  const canScroll = view === "evaluation" && !hasSample
  const comp = (
    <div
      ref={ref}
      className={`absolute top-0 left-0 h-full w-full max-h-screen pointer-events-none select-none ${
        isActive
          ? `overflow-auto ${canScroll ? "pointer-events-auto!" : ""}`
          : ""
      } transition-[padding] duration-[var(--tile-duration)] flex flex-col gap-2 sm:gap-4 items-start`}
    >
      {children}
    </div>
  )
  const shouldUsePortal = isActive && localActive && section === "learn"
  return shouldUsePortal && lessonOverlayPortal.current
    ? createPortal(comp, lessonOverlayPortal.current!)
    : comp
}

function useIsScrolledBodyClass(
  ref: React.RefObject<HTMLElement | null>,
  className: string
) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => {
      if (el.scrollTop > 0) document.body.classList.add(className)
      else document.body.classList.remove(className)
    }
    el.addEventListener("scroll", onScroll)
    onScroll()
    return () => {
      el.removeEventListener("scroll", onScroll)
      document.body.classList.remove(className)
    }
  }, [ref, className])
}
