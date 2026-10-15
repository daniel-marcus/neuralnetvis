"use client"

import { cloneElement, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { useGlobalStore } from "@/store"
import { useDomRefs } from "@/utils/dom-refs"
import { LockButton, useLock } from "@/scene-views/3d-model/lock"
import { useBodyFreeze } from "@/utils/body-freeze"
import { Ctas, CurrSceneProvider } from "@/contents/elements"
import type { LessonContent, LessonDef, LessonPreview } from "@/contents/types"

interface LessonProps extends LessonDef {
  nextLesson?: LessonPreview
}

export const Lesson = (props: LessonProps) => {
  const { content, nextLesson } = props
  const children = useContent(content)
  const visLocked = useLock()
  const isDebug = useGlobalStore((s) => s.isDebug)
  const ref = useRef<HTMLDivElement>(null)
  useBodyFreeze(!visLocked, ref) // unlocked: no scrolling through the lesson
  return (
    <>
      <LessonGradient hidden={!visLocked} />
      <div
        ref={ref}
        className={`relative z-20 pt-[20vh] pb-[50dvh]! w-full max-w-screen overflow-x-clip ${
          visLocked && !isDebug ? "" : "pointer-events-none"
        } ${visLocked ? "" : "opacity-0"} transition-opacity duration-[calc(2*var(--tile-duration))]`}
      >
        <div className="p-main lesson-width">
          <CurrSceneProvider>{children}</CurrSceneProvider>
          <Ctas nextLesson={nextLesson} />
        </div>
      </div>
      {!visLocked && (
        <div className="fixed z-30 left-0 top-(--logo-height) p-main">
          <LockButton />
        </div>
      )}
    </>
  )
}

export function LessonOverlayPortal() {
  const { lessonOverlayRef } = useDomRefs()
  return <div ref={lessonOverlayRef} className="absolute z-20 pointer-events-none inset-0" />
}

function LessonGradient({ hidden }: { hidden?: boolean }) {
  useScrollZero()
  const hasLesson = useHasLesson()
  return (
    <div
      className={`absolute z-10 scroll-zero:fixed top-0 w-full h-[120vh] bg-linear-to-b from-background to-transparent pointer-events-none ${
        hasLesson && !hidden ? "opacity-50" : "opacity-0"
      } transition-opacity duration-700`}
    />
  )
}

function useContent(content: LessonDef["content"]) {
  const main = content()
  const children = main.props.children.map((c, i, arr) =>
    cloneElement(c, { key: i, nextProps: arr[i + 1]?.props }),
  )
  return (<main>{children}</main>) as LessonContent
}

export function useHasLesson() {
  const pathname = usePathname()
  return pathname.startsWith("/learn/")
}

function useScrollZero() {
  const [scrollZero, setScrollZero] = useState(true)
  useEffect(() => {
    const onScroll = () => setScrollZero(window.scrollY <= 0)
    window.addEventListener("scroll", onScroll)
    onScroll()
    return () => {
      window.removeEventListener("scroll", onScroll)
    }
  }, [])
  useEffect(() => {
    if (scrollZero) document.body.classList.add("scroll-zero")
    else document.body.classList.remove("scroll-zero")
  }, [scrollZero])
}
