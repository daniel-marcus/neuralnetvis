import { useEffect } from "react"

type Callback = () => void | Promise<void>

export function useKeyCommand(key: string, cb: Callback, isActive = true, preventDefault = false) {
  useEffect(() => {
    if (!isActive) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditable(document.activeElement)) return
      if (e.key === key) {
        if (preventDefault) e.preventDefault()
        cb()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [key, cb, isActive, preventDefault])
}

function isEditable(el: Element | null) {
  const tagName = el?.tagName.toLowerCase()
  return (
    tagName === "input" || tagName === "textarea" || (el as HTMLElement | null)?.isContentEditable
  )
}
