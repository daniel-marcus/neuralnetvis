"use client"

import { ReactNode, useEffect, useLayoutEffect } from "react"
import { useController } from "../lib/controller"
import { useInView } from "@/lib/utils"
import { TabSetter } from "./menu"
import { getLessonPath, LessonDef, LessonPreview } from "@/lessons/all-lessons"
import Link from "next/link"
import { create } from "zustand"
import throttle from "lodash.throttle"
import { useAsciiText } from "@/lib/ascii-text"
import { useLockStore } from "./lock"
import { usePathname } from "next/navigation"
import { CollapsibleWithTitle } from "@/ui-components"

interface LessonProps extends LessonDef {
  nextLesson?: LessonPreview
}

interface LessonStore {
  currLesson: LessonProps["slug"] | null
  setCurrLesson: (slug: string | null) => void
}

export const useLessonStore = create<LessonStore>((set) => ({
  currLesson: null,
  setCurrLesson: (slug: string | null) => set({ currLesson: slug }),
}))

export function useHasLesson() {
  const pathname = usePathname()
  return pathname.startsWith("/learn/")
}

export const Lesson = ({
  title,
  description,
  slug,
  content,
  nextLesson,
}: LessonProps) => {
  const setCurrLesson = useLessonStore((s) => s.setCurrLesson)
  const setVisualizationLocked = useLockStore((s) => s.setVisualizationLocked)
  useLayoutEffect(() => {
    setCurrLesson(slug)
    setVisualizationLocked(true)
    return () => {
      setCurrLesson(null)
      setVisualizationLocked(false)
    }
  }, [slug, setCurrLesson, setVisualizationLocked])
  const children = typeof content === "function" ? content() : content
  const hasHead = !!children.props.children.find((c) => c.type === LessonHead)
  const visualizationLocked = useLockStore((s) => s.visualizationLocked)
  return (
    <div
      className={`relative pt-[20vh] pb-[50dvh]! w-full max-w-screen overflow-hidden ${
        visualizationLocked ? "" : "pointer-events-none"
      }`}
    >
      <TabSetter slugs={null} />
      <div className="p-main lg:max-w-[90vw] xl:max-w-[calc(100vw-2*var(--logo-width))] mx-auto">
        {!hasHead && <LessonHead title={title} description={description} />}
        {children}
        <Ctas nextLesson={nextLesson} />
      </div>
    </div>
  )
}

type LessonHeadProps = { title: string; description: string } & ScrollCallbacks

export function LessonHead(props: LessonHeadProps) {
  const { title, description, ...callbacks } = props
  const [ref] = useScrollCallbacks(callbacks)
  return (
    <div ref={ref}>
      <Title>{title}</Title>
      <Teaser>{description}</Teaser>
    </div>
  )
}

function Title({ children }: { children: string }) {
  const title = useAsciiText(children)
  return (
    <div className="mb-12">
      <h1 className="hidden">{children}</h1>
      <pre className="text-[min(1.25vw,0.75rem)]/[1.2]">{title}</pre>
    </div>
  )
}

function Teaser({ children }: { children: ReactNode }) {
  return <div className="pb-[50dvh]">{children}</div>
}

export const Button = ({
  children,
  onClick,
  className = "",
}: {
  children: string
  onClick: () => void
  className?: string
}) => (
  <button
    className={`bg-accent text-white px-4 py-2 rounded ${className}`}
    onClick={onClick}
  >
    {children}
  </button>
)

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

export function Details({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <CollapsibleWithTitle
      title={title}
      variant="has-bg"
      collapsed
      className="inline-block mt-8 max-w-[32rem]"
    >
      {children}
    </CollapsibleWithTitle>
  )
}

type ControllerProps = ReturnType<typeof useController>

export interface OnBlockScrollProps extends ControllerProps {
  percent: number
}

export type OnBlockEnterLeaveProps = ControllerProps

export type ScrollBlockProps = React.PropsWithChildren<ScrollCallbacks> & {
  className?: string
}

interface ScrollCallbacks {
  onScroll?: (props: OnBlockScrollProps) => void
  onEnter?: (props: OnBlockEnterLeaveProps) => void
  onLeave?: (props: OnBlockEnterLeaveProps) => void
}

export function Block({ children, className, ...callbacks }: ScrollBlockProps) {
  const [ref, inView] = useScrollCallbacks(callbacks)
  return (
    <div
      ref={ref}
      className={`pb-[50dvh] ${
        inView ? "opacity-100 " : "opacity-50"
      } transition-opacity duration-100 ${className ?? ""}`}
    >
      {children}
    </div>
  )
}

function useScrollCallbacks(callbacks: ScrollCallbacks) {
  const { onScroll, onEnter, onLeave } = callbacks
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
