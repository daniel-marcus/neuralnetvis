"use client"

import { usePathname } from "next/navigation"
import { useLock } from "@/scene/lock"
import { Ctas } from "@/contents/elements"
import { cloneElement, useEffect } from "react"
import { useStore } from "@/store"
import type { LessonContent, LessonDef, LessonPreview } from "@/contents"
import { Scene } from "@/scene"

interface LessonProps extends LessonDef {
  nextLesson?: LessonPreview
}

function useContent(content: LessonDef["content"]) {
  const main = content()
  const children = main.props.children.map((c, i, arr) =>
    cloneElement(c, { key: i, nextProps: arr[i + 1]?.props })
  )
  return (<main>{children}</main>) as LessonContent
}

export const Lesson = (props: LessonProps) => {
  const { content, nextLesson } = props
  const children = useContent(content)
  useTabClose()
  const visLocked = useLock()
  const isDebug = useStore((s) => s.isDebug)
  return (
    <>
      <Scene />
      <div
        className={`relative pt-[20vh] pb-[50dvh]! w-full max-w-screen overflow-x-clip ${
          visLocked && !isDebug ? "" : "pointer-events-none"
        }`}
      >
        <div className="p-main lg:max-w-[90vw] xl:max-w-[calc(100vw-2*var(--logo-width))] mx-auto">
          {children}
          <Ctas nextLesson={nextLesson} />
        </div>
      </div>
    </>
  )
}

export function useHasLesson() {
  const pathname = usePathname()
  return pathname.startsWith("/learn/")
}

function useTabClose() {
  const setTab = useStore((s) => s.setTab)
  useEffect(() => {
    setTab(null)
  }, [setTab])
}
