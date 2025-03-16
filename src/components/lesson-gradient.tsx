import { useHasLesson } from "./lesson"
import { useEffect, useState } from "react"

export const LessonGradient = () => {
  useScrollZero()
  const hasLesson = useHasLesson()
  return (
    <div
      className={`absolute z-10 scroll-zero:fixed top-0 w-full h-[120vh] bg-gradient-to-b from-background to-transparent pointer-events-none ${
        hasLesson ? "opacity-50" : "opacity-0"
      } transition-opacity duration-700`}
    />
  )
}

function useScrollZero() {
  const [scollZero, setScrollZero] = useState(true)
  useEffect(() => {
    const onScroll = () => setScrollZero(window.scrollY <= 0)
    window.addEventListener("scroll", onScroll)
    onScroll()
    return () => {
      window.removeEventListener("scroll", onScroll)
    }
  }, [])
  useEffect(() => {
    if (scollZero) document.body.classList.add("scroll-zero")
    else document.body.classList.remove("scroll-zero")
  }, [scollZero])
}
