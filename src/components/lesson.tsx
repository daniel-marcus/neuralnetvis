"use client"

import { cloneElement, useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { useGlobalStore } from "@/store"
import { useLock } from "@/scene-views/3d-model/lock"
import { Ctas } from "@/contents/elements"
import type { LessonContent, LessonDef, LessonPreview } from "@/contents"

interface LessonProps extends LessonDef {
  nextLesson?: LessonPreview
}

export const Lesson = (props: LessonProps) => {
  const { content, nextLesson } = props
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => setIsMounted(true), [])
  const children = useContent(content)
  const visLocked = useLock()
  const isDebug = useGlobalStore((s) => s.isDebug)
  return (
    <>
      <LessonGradient />
      <div
        className={`relative z-20 pt-[20vh] pb-[50dvh]! w-full max-w-screen overflow-x-clip ${
          visLocked && !isDebug ? "" : "pointer-events-none"
        } ${
          isMounted ? "" : "opacity-0"
        } transition-opacity duration-[calc(2*var(--tile-duration))]`}
      >
        <div className="p-main lesson-width">
          {children}
          <Ctas nextLesson={nextLesson} />
        </div>
      </div>
    </>
  )
}

function LessonGradient() {
  useScrollZero()
  const hasLesson = useHasLesson()
  return (
    <div
      className={`absolute z-10 scroll-zero:fixed top-0 w-full h-[120vh] bg-gradient-to-b from-background to-transparent pointer-events-none ${
        hasLesson ? "opacity-50" : "opacity-0"
      } transition-opacity duration-700`}
    />
  )
}

function useContent(content: LessonDef["content"]) {
  const main = content()
  const children = main.props.children.map((c, i, arr) =>
    cloneElement(c, { key: i, nextProps: arr[i + 1]?.props })
  )
  return (<main>{children}</main>) as LessonContent
}

export function useHasLesson() {
  const pathname = usePathname()
  return pathname.startsWith("/learn/")
}

function useScrollZero() {
  const [scollZero, setScrollZero] = useState(true)
  useEffect(() => {
    const onScroll = () => setScrollZero(window.scrollY <= 0)
    window.addEventListener("scroll", onScroll)
    onScroll()
    return () => {
      window.removeEventListener("scroll", onScroll)
    }
  }, [])
  useEffect(() => {
    if (scollZero) document.body.classList.add("scroll-zero")
    else document.body.classList.remove("scroll-zero")
  }, [scollZero])
}
