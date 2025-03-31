"use client"

import { usePathname } from "next/navigation"
import { useLock } from "@/scene/lock"
import { Ctas } from "@/contents/elements"
import { cloneElement, useEffect, useState } from "react"
import { useGlobalStore } from "@/store"
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
