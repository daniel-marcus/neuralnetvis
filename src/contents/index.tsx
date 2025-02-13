import { introInterface } from "./exploring-the-interface"
import { IntroNetworks } from "./how-networks-learn"
import type { ReactElement } from "react"
import type { ScrollBlockProps } from "@/contents/elements/types"

export type LessonContent = ReactElement<{
  children: ReactElement<ScrollBlockProps>[]
}> // <main> with <Block> children

export interface LessonDef {
  title: string
  slug: string
  description: string
  content: LessonContent | (() => LessonContent)
}

export const lessons: LessonDef[] = [
  {
    title: "How do networks learn?",
    slug: "how-networks-learn",
    description: "Some basics about machine learning",
    content: IntroNetworks,
  },
  {
    title: "Exploring the interface",
    slug: "exploring-the-interface",
    description: "Learn what you can see and do here",
    content: introInterface,
  },
]

export type LessonPreview = Omit<LessonDef, "content"> & {
  path: string
}

export const lessonPreviews: LessonPreview[] = lessons.map((l) => {
  const { title, slug, description } = l
  return {
    title,
    slug,
    description,
    path: getLessonPath(slug),
  }
})

export function getLessonPath(slug: string) {
  return `/learn/${slug}`
}
