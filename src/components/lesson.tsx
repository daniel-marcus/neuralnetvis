"use client"

import { usePathname } from "next/navigation"
import { useLock } from "@/scene/lock"
import { TabSetter } from "@/components/menu"
import { Head } from "@/contents/elements/head"
import { Ctas } from "@/contents/elements/ctas"
import type { LessonDef, LessonPreview } from "@/contents"

interface LessonProps extends LessonDef {
  nextLesson?: LessonPreview
}

export const Lesson = (props: LessonProps) => {
  const { title, description, content, nextLesson } = props
  const visLocked = useLock()
  const children = typeof content === "function" ? content() : content
  const hasHead = !!children.props.children.find((c) => c.type === Head)
  return (
    <div
      className={`relative pt-[20vh] pb-[50dvh]! w-full max-w-screen overflow-hidden ${
        visLocked ? "" : "pointer-events-none"
      }`}
    >
      <TabSetter slugs={null} />
      <div className="p-main lg:max-w-[90vw] xl:max-w-[calc(100vw-2*var(--logo-width))] mx-auto">
        {!hasHead && <Head title={title} description={description} />}
        {children}
        <Ctas nextLesson={nextLesson} />
      </div>
    </div>
  )
}

export function useHasLesson() {
  const pathname = usePathname()
  return pathname.startsWith("/learn/")
}
