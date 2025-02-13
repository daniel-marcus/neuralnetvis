import { create } from "zustand"
import { Button } from "@/components/lesson"

interface LockStore {
  visualizationLocked: boolean
  setVisualizationLocked: (locked: boolean) => void
  toggleVisualizationLocked: () => void
}

export const useLockStore = create<LockStore>((set) => ({
  visualizationLocked: false,
  setVisualizationLocked: (locked) => set({ visualizationLocked: locked }),
  toggleVisualizationLocked: () =>
    set((s) => ({ visualizationLocked: !s.visualizationLocked })),
}))

export const LockButton = () => {
  const visualizationLocked = useLockStore((s) => s.visualizationLocked)
  const toggleVisualizationLocked = useLockStore(
    (s) => s.toggleVisualizationLocked
  )
  return (
    <Button onClick={toggleVisualizationLocked} className="pointer-events-auto">
      {visualizationLocked ? "Unlock visualization" : "Back to scrolling"}
    </Button>
  )
}
