import Link from "next/link"
import { getLessonPath, type LessonPreview } from ".."

export function Ctas({ nextLesson }: { nextLesson?: LessonPreview }) {
  return (
    <div className="mt-[50dvh] flex justify-start translate-y-1/2">
      {!!nextLesson ? (
        <Link
          href={getLessonPath(nextLesson.slug)}
          className="bg-accent text-white px-4 py-2 rounded"
        >
          Next: {nextLesson.title}
        </Link>
      ) : (
        <Link href="/play" className="bg-accent text-white px-4 py-2 rounded">
          Ready to play?
        </Link>
      )}
    </div>
  )
}

interface ButtonProps {
  children: string
  onClick: () => void
  className?: string
}

export const Button = ({ children, onClick, className = "" }: ButtonProps) => (
  <button
    className={`bg-accent text-white px-4 py-2 rounded ${className}`}
    onClick={onClick}
  >
    {children}
  </button>
)
