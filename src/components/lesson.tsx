"use client"

import { ReactElement, ReactNode, useCallback, useEffect } from "react"
import { useController } from "./controller"
import { useInView } from "@/lib/in-view"
import { TabSetter } from "./menu"
import { getLessonPath } from "@/lessons/all-lessons"
import Link from "next/link"
import { create } from "zustand"

export type LessonType = ReactElement<LessonProps>

export interface LessonPreview {
  slug: string
  path: string
  title: string
  // description: string
}

export interface LessonProps {
  slug: string
  title: string
  children: ReactElement<BlockProps>[]
  nextLesson?: LessonPreview
  // lang: Lang
  // onInit?: () => void
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

export const Lesson = ({ title, slug, children, nextLesson }: LessonProps) => {
  const setCurrLesson = useLessonStore((s) => s.setCurrLesson)
  useEffect(() => {
    setCurrLesson(slug)
    return () => {
      setCurrLesson(null)
    }
  }, [slug, setCurrLesson])
  return (
    <div className="relative z-10 p-main mt-32 pb-[50dvh] w-full">
      <TabSetter slugs={null} />
      <div className="max-w-[1200px] mx-auto">
        <Title>{title}</Title>
        {children}
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
    <div className="mt-[50dvh] flex justify-start">
      {!!nextLesson ? (
        <Link
          href={getLessonPath(nextLesson.slug)}
          className="bg-accent text-white px-4 py-2 rounded"
        >
          Next: {nextLesson.title}
        </Link>
      ) : (
        <Link href="/" className="bg-accent text-white px-4 py-2 rounded">
          Ready to play!
        </Link>
      )}
    </div>
  )
}

export interface BlockProps {
  children: ReactNode
  onScroll?: (percent: number) => void
}

export function Block({ children }: BlockProps) {
  const { dataStore, three } = useController()
  const [ref, inView] = useInView({ rootMargin: "-50% 0px" })

  const calculateScrolledPercentage = useCallback(() => {
    if (!ref.current) return 0
    const rect = ref.current.getBoundingClientRect()
    const windowHeight = window.innerHeight
    const middleY = windowHeight / 2

    if (rect.bottom <= middleY) return 1
    if (rect.top >= middleY) return 0
    return Math.round(((middleY - rect.top) / rect.height) * 1000) / 1000
  }, [ref])

  useEffect(() => {
    if (!inView) return
    const onScroll = () => {
      const percent = calculateScrolledPercentage()
      const newI = Math.round(percent * 100)
      dataStore.setValueAtPath("i", newI, false)

      if (!three) return
      const camera = three.camera
      function rotate(percent: number) {
        const angle = percent * Math.PI * 2 // Full rotation
        const radius = Math.sqrt(22.5 * 22.5 + 35 * 35) // Distance from origin
        camera.position.x = Math.sin(angle) * radius
        camera.position.z = Math.cos(angle) * radius
        camera.lookAt(0, 0, 0)
      }
      rotate(percent)
    }
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [inView, calculateScrolledPercentage, dataStore, three])

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
