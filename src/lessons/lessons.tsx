import { Block, BlockProps } from "@/components/lesson-block"
import { Lang } from "@/lib/langs"
import { ReactElement } from "react"

export interface LessonType {
  slug: string
  lang: Lang
  title: string
  content: ReactElement<{ children: ReactElement<BlockProps>[] }>
  // onInit to set up the scene?
}

export const lessons: LessonType[] = [
  {
    slug: "how-networks-learn",
    lang: "en",
    title: "How can networks learn?",
    content: (
      <div>
        <Block>Welcome to the lesson!</Block>
        <Block>Here is some content.</Block>
        <Block>Here is some content.</Block>
        <Block>Here is some content.</Block>
        <Block>Here is some content.</Block>
        <Block>Here is some content.</Block>
        <Block>Here is some content.</Block>
        <Block>Here is some content.</Block>
        <Block>Here is some content.</Block>
      </div>
    ),
  },
  {
    slug: "exploring-the-interface",
    lang: "en",
    title: "Exploring the interface",
    content: (
      <div>
        <Block>Advanced content.</Block>
        <Block>Here is some more content.</Block>
      </div>
    ),
  },
]

export function getLessonPath(slug: string) {
  return `/learn/${slug}`
}
