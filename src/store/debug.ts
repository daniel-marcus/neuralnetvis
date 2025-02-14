import { StateCreator } from "zustand"

export interface DebugSlice {
  isDebug: boolean
  toggleDebug: () => void
}

export const createDebugSlice: StateCreator<DebugSlice> = (set) => ({
  isDebug: false,
  toggleDebug: () => set((s) => ({ isDebug: !s.isDebug })),
})
