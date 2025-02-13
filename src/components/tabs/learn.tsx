import { Box, MenuBtn } from "@/components/ui-elements"
import { lessonPreviews } from "@/contents"
import { usePathname } from "next/navigation"

export const Learn = () => {
  const pathname = usePathname()
  const currLesson = pathname.replace(/^\/learn\//, "")
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
