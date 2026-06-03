import { IntroNetworks, hmlInitialState } from "./how-machines-learn"
import { getLessonPath } from "./types"
import type { LessonDef, LessonPreview } from "./types"

export const lessons: LessonDef[] = [
  {
    title: "How do machines learn?",
    slug: "how-machines-learn",
    description: "Let's train a neural network to recognize handwritten digits (test content)",
    content: IntroNetworks,
    dsKey: "mnist",
    initialState: hmlInitialState,
    disabled: true,
  },
]

export const lessonPreviews: LessonPreview[] = lessons.map((l) => {
  const { content, ...lessonDef } = l // eslint-disable-line @typescript-eslint/no-unused-vars
  return {
    ...lessonDef,
    path: getLessonPath(lessonDef.slug),
  }
})
