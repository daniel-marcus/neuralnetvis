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
  return (
    <div
      className="fixed bottom-0 right-0 text-right text-sm p-4 text-white select-none max-w-[50%] overflow-auto"
      dangerouslySetInnerHTML={{ __html: statusText }}
    ></div>
  )
}
