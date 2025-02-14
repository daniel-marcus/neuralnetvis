import { Lesson } from "@/components/lesson"
import { lessonPreviews, lessons } from "@/contents"
import { metadata } from "@/app/layout"
import manifest from "@/app/manifest.json"
import type { Metadata } from "next"

type Params = Promise<{ slug: string }>

export async function generateMetadata(props: { params: Params }) {
  const { slug } = await props.params
  const lesson = getLessonFromSlug(slug) ?? { title: "", description: "" }
  const { title, description } = lesson
  return {
    ...metadata,
    title: `${title} | ${manifest.name}`,
    description,
  } as Metadata
}

export default async function LessonPage(props: { params: Params }) {
  const { slug } = await props.params
  const lesson = getLessonFromSlug(slug)
  if (!lesson) return <div className="relative z-10 p-4">404</div> // TODO: styled 404
  const currIdx = lessonPreviews.findIndex((l) => l.slug === lesson.slug)
  const nextLesson = lessonPreviews[currIdx + 1]
  return <Lesson {...lesson} nextLesson={nextLesson} />
}

export async function generateStaticParams() {
  return lessons.map((l) => ({ slug: l.slug }))
}

function getLessonFromSlug(slug: string) {
  return lessons.find((l) => l.slug === slug)
}
