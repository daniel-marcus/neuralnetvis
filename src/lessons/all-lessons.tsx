import { LessonPreview, LessonType } from "@/components/lesson"
import { introInterface } from "./exploring-the-interface"
import { introNetworks } from "./how-networks-learn"

export const lessons: LessonType[] = [introNetworks, introInterface]

export const lessonPreviews: LessonPreview[] = lessons.map(
  ({ props: { title, slug } }) => ({
    title,
    slug,
    path: getLessonPath(slug),
  })
)

export function getLessonPath(slug: string) {
  return `/learn/${slug}`
}
