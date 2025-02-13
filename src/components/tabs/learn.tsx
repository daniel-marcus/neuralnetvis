import { useLessonStore } from "@/components/lesson"
import { Box, MenuBtn } from "@/components/ui-elements"
import { lessonPreviews } from "@/contents"

export const Learn = () => {
  const currLesson = useLessonStore((s) => s.currLesson)
  return (
    <Box className="flex flex-col">
      {lessonPreviews.map((l) => (
        <MenuBtn key={l.slug} href={l.path} isActive={currLesson === l.slug}>
          <strong>{l.title}</strong>
          <br />
          {l.description}
        </MenuBtn>
      ))}
    </Box>
  )
}
