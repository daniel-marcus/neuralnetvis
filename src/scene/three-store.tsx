import { RootState, useThree } from "@react-three/fiber"
import { useEffect } from "react"
import { create } from "zustand"

interface ReducedThree {
  camera: RootState["camera"]
  invalidate: RootState["invalidate"]
  gl: RootState["gl"]
}

interface ThreeStore {
  three?: ReducedThree
  setThree: (three: ReducedThree) => void
}

export const useThreeStore = create<ThreeStore>((set) => ({
  three: undefined,
  setThree: (three) => set({ three }),
}))

export const ThreeStoreSetter = () => {
  const { camera, invalidate, gl } = useThree()
  const setThree = useThreeStore((s) => s.setThree)
  useEffect(() => {
    // console.log("three changed")
    setThree({ camera, invalidate, gl })
  }, [camera, invalidate, gl, setThree])
  return null
}

export function getThree() {
  return useThreeStore.getState().three
}
