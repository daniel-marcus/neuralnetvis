import { IntroNetworks, hmlInitialState } from "./how-machines-learn"
import type { ReactElement } from "react"
import type { ScrollBlockProps } from "@/contents/elements/types"
import { InitialState } from "@/utils/initial-state"

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
  initialState?: InitialState
}

export const lessons: LessonDef[] = [
  {
    title: "How do machines learn?",
    slug: "how-machines-learn",
    description: "Some basics about machine learning",
    content: IntroNetworks,
    dsKey: "mnist",
    initialState: hmlInitialState,
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
