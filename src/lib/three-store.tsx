import { RootState, useThree } from "@react-three/fiber"
import { useEffect } from "react"
import { create } from "zustand"

interface ReducedThree {
  camera: RootState["camera"]
}

interface ThreeStore {
  three: ReducedThree | null
  setThree: (three: ReducedThree) => void
}

export const useThreeStore = create<ThreeStore>((set) => ({
  three: null,
  setThree: (three) => set({ three }),
}))

export const ThreeStoreSetter = () => {
  const three = useThree()
  const setThree = useThreeStore((s) => s.setThree)
  useEffect(() => {
    console.log("three changed", three?.camera)
    setThree({ camera: three?.camera })
  }, [three?.camera, setThree])
  return null
}
