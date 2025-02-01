import { lessons, LessonType } from "@/lessons/lessons"
import Link from "next/link"
import React from "react"

export default async function LessonPage(props: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await props.params
  const lesson = lessons.find((l) => l.slug === slug)
  if (!lesson) return <div className="relative z-10 p-4">404</div>
  const children = React.Children.toArray(lesson.content.props.children)
  return (
    <div className="relative z-10 p-4 mt-32 pb-[50dvh] w-full">
      <div className="max-w-[1200px] mx-auto">
        <Title>{lesson.title}</Title>
        {children}
        <Ctas lesson={lesson} />
      </div>
    </div>
  )
}

export async function generateStaticParams() {
  return lessons.map((l) => ({
    slug: l.slug,
  }))
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

function Ctas({ lesson }: { lesson: LessonType }) {
  const currIdx = lessons.findIndex((l) => l.slug === lesson?.slug)
  const nextLesson = lessons[currIdx + 1]
  return (
    <div className="mt-[50dvh] flex justify-start">
      {!!nextLesson ? (
        <Link
          href={`/en/learn/${nextLesson.slug}`}
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
