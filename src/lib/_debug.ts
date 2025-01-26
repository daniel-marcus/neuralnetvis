import { create } from "zustand"

export const useDebug = create<{
  debug: boolean
  toggleDebug: () => void
}>((set) => ({
  debug: false,
  toggleDebug: () => set((s) => ({ debug: !s.debug })),
}))

export const debug = () => useDebug.getState().debug
