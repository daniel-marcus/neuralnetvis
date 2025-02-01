import { RootState, useThree } from "@react-three/fiber"
import { useEffect } from "react"
import { create } from "zustand"

interface ThreeStore {
  three: RootState | null
  setThree: (three: RootState) => void
}

export const useThreeStore = create<ThreeStore>((set) => ({
  three: null,
  setThree: (three) => set({ three }),
}))

export const ThreeStoreSetter = () => {
  const three = useThree()
  const setThree = useThreeStore((s) => s.setThree)
  useEffect(() => {
    setThree(three)
  }, [three, setThree])
  return null
}
