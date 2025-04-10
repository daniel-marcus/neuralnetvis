import { useEffect } from "react"

type Callback = () => void | Promise<void>

export function useKeyCommand(key: string, cb: Callback, isActive = true) {
  useEffect(() => {
    if (!isActive) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName.toLowerCase() === "input") return
      if (e.key === key) cb()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [key, cb, isActive])
}
