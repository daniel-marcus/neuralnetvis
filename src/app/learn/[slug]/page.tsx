import { lessonPreviews, lessons } from "@/lessons/all-lessons"
import React from "react"

export default async function LessonPage(props: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await props.params
  const lesson = lessons.find((l) => l.props.slug === slug)
  if (!lesson) return <div className="relative z-10 p-4">404</div>
  const currIdx = lessonPreviews.findIndex((l) => l.slug === lesson.props.slug)
  const nextLesson = lessonPreviews[currIdx + 1]
  return React.cloneElement(lesson, { ...lesson.props, nextLesson })
}

export async function generateStaticParams() {
  return lessons.map((l) => ({
    slug: l.props.slug,
  }))
}
