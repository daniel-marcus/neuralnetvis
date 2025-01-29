import { useRef, useEffect } from "react"
import { create } from "zustand"

export const useStatusText = create<{
  statusText: string
  setStatusText: (t: string) => void
}>((set) => ({
  statusText: "",
  setStatusText: (newText: string) => set({ statusText: newText }),
}))

export const StatusText = () => {
  const statusText = useStatusText((s) => s.statusText)
  const keptText = useRef<string>("")
  useEffect(() => {
    if (statusText) {
      keptText.current = statusText
    }
  }, [statusText])
  return (
    <div
      className={`fixed z-[2] bottom-0 right-0 text-right p-4 select-none max-w-[50vh] text-sm ${
        !!statusText ? "opacity-100 duration-0" : "opacity-0 duration-300"
      } transition-opacity ease-in-out pointer-events-none`}
      dangerouslySetInnerHTML={{ __html: statusText || keptText.current }}
    ></div>
  )
}
