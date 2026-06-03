import type { ReactElement } from "react"
import type { ScrollBlockProps } from "@/contents/elements/types"
import type { InitialState } from "@/utils/initial-state"

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

export type LessonPreview = Omit<LessonDef, "content"> & {
  path: string
}

export function getLessonPath(slug: string) {
  return `/learn/${slug}`
}
