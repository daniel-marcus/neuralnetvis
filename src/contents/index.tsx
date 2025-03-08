import { IntroInterface } from "./exploring-the-interface"
import { IntroNetworks } from "./how-machines-learn"
import type { ReactElement } from "react"
import type { ScrollBlockProps } from "@/contents/elements/types"

export type LessonContent = ReactElement<{
  children: ReactElement<ScrollBlockProps>[]
}> // <main> with <Block> children

export interface LessonDef {
  title: string
  slug: string
  description: string
  content: () => LessonContent
  disabled?: boolean
  dsKey?: string
}

export const lessons: LessonDef[] = [
  {
    title: "How do machines learn?",
    slug: "how-machines-learn",
    description: "Some basics about machine learning",
    content: IntroNetworks,
    dsKey: "mnist",
  },
  {
    title: "Exploring the interface",
    slug: "exploring-the-interface",
    description: "Learn what you can see and do here",
    content: IntroInterface,
    disabled: true,
  },
]

export type LessonPreview = Omit<LessonDef, "content"> & {
  path: string
}

export const lessonPreviews: LessonPreview[] = lessons.map((l) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { content, ...lessonDef } = l
  return {
    ...lessonDef,
    path: getLessonPath(lessonDef.slug),
  }
})

export function getLessonPath(slug: string) {
  return `/learn/${slug}`
}
