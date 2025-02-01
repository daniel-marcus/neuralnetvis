"use client"

import { ReactNode, useEffect } from "react"
import { useController } from "./controller"
import { useInView } from "@/lib/in-view"
import { TabSetter } from "./menu"
import { getLessonPath, LessonDef, LessonPreview } from "@/lessons/all-lessons"
import Link from "next/link"
import { create } from "zustand"
import throttle from "lodash.throttle"

interface LessonProps extends LessonDef {
  nextLesson?: LessonPreview
}

interface LessonStore {
  currLesson: LessonProps["slug"] | null
  isLearnMoode: () => boolean
  setCurrLesson: (slug: string | null) => void
}

export const useLessonStore = create<LessonStore>((set, get) => ({
  currLesson: null,
  isLearnMoode: () => !!get().currLesson,
  setCurrLesson: (slug: string | null) => set({ currLesson: slug }),
}))

export const Lesson = ({
  title,
  description,
  slug,
  content,
  nextLesson,
}: LessonProps) => {
  const setCurrLesson = useLessonStore((s) => s.setCurrLesson)
  useEffect(() => {
    setCurrLesson(slug)
    return () => {
      setCurrLesson(null)
    }
  }, [slug, setCurrLesson])
  return (
    <div className="relative z-10 p-main mt-32 pb-[50dvh]! w-full">
      <TabSetter slugs={null} />
      <div className="max-w-[1200px] mx-auto">
        <Title>{title}</Title>
        <div className="mb-[20vh]">{description}</div>
        {typeof content === "function" ? content() : content}
        <Ctas nextLesson={nextLesson} />
      </div>
    </div>
  )
}

function Title({ children }: { children: string }) {
  const length = children.length
  const underline = "=".repeat(length)
  return (
    <div className="mb-8">
      <h1>{children}</h1>
      <div>{underline}</div>
    </div>
  )
}

function Ctas({ nextLesson }: { nextLesson?: LessonPreview }) {
  return (
    <div className="mt-[50dvh] flex justify-start translate-y-1/2">
      {!!nextLesson ? (
        <Link
          href={getLessonPath(nextLesson.slug)}
          className="bg-accent text-white px-4 py-2 rounded"
        >
          Next: {nextLesson.title}
        </Link>
      ) : (
        <Link href="/play" className="bg-accent text-white px-4 py-2 rounded">
          Ready to play?
        </Link>
      )}
    </div>
  )
}

type ControllerProps = ReturnType<typeof useController>

export interface OnBlockScrollProps extends ControllerProps {
  percent: number
}

export type OnBlockEnterLeaveProps = ControllerProps

export interface BlockProps {
  children: ReactNode
  onScroll?: (props: OnBlockScrollProps) => void
  onEnter?: (props: OnBlockEnterLeaveProps) => void
  onLeave?: (props: OnBlockEnterLeaveProps) => void
}

export function Block({ children, onScroll, onEnter, onLeave }: BlockProps) {
  const controller = useController()
  const [ref, inView] = useInView({ rootMargin: "-50% 0px" })

  useEffect(() => {
    if (!inView) return
    if (!onScroll) return
    const onScrollCb = () => {
      if (!ref.current) return
      const percent = calculateScrolledPercent(ref)
      onScroll({ percent, ...controller })
    }
    const throttledOnScrollCb = throttle(onScrollCb, 10)
    window.addEventListener("scroll", throttledOnScrollCb)
    return () => window.removeEventListener("scroll", throttledOnScrollCb)
  }, [inView, controller, onScroll, ref])

  useEffect(() => {
    if (!onEnter && !onLeave) return
    if (!inView) return
    if (onEnter) onEnter(controller)
    return () => {
      if (onLeave) onLeave(controller)
    }
  }, [inView, onEnter, onLeave, controller])

  return (
    <div
      ref={ref}
      className={`pb-[50dvh] ${
        inView ? "opacity-100 " : "opacity-50"
      } transition-opacity duration-100`}
    >
      {children}
    </div>
  )
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
  const percent = Math.round(((middleY - rect.top) / rect.height) * 1000) / 1000
  return percent
}
