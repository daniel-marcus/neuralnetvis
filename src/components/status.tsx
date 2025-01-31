import { useRef, useEffect } from "react"
import { create } from "zustand"

export const useStatusText = create<{
  percent: number | null
  setPercent: (p: number | null) => void
  statusText: string | null
  setStatusText: (t: string, percent?: number | null) => void
}>((set) => ({
  percent: null, // -1 for spinner mode
  setPercent: (percent: number | null) => set({ percent }),
  statusText: null,
  setStatusText: (newText: string | null, newPercent?: number | null) =>
    set(({ percent }) => ({
      statusText: newText,
      percent: typeof newPercent !== "undefined" ? newPercent : percent,
    })),
}))

export const Status = () => {
  const statusText = useStatusText((s) => s.statusText)
  const keptText = useRef<string>("")
  useEffect(() => {
    if (statusText !== null) {
      keptText.current = statusText
    }
  }, [statusText])
  return (
    <div
      className={`max-w-[50vh] ml-auto text-right ${
        !!statusText ? "opacity-100 duration-0" : "opacity-50 duration-300"
      } transition-opacity ease-in-out`}
      dangerouslySetInnerHTML={{ __html: statusText || keptText.current }}
    />
  )
}
