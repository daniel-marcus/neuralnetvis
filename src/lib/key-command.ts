import { useEffect } from "react"

type Callback = () => void | Promise<void>

export function useKeyCommand(key: string, callback: Callback) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName.toLowerCase() === "input") return
      if (e.key === key) {
        callback()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [key, callback])
}
