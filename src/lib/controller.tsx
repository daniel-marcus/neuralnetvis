import { useMemo } from "react"
import { useTabStore } from "../components/menu"
import { useThreeStore } from "@/three/three-store"
import { useTrainingStore } from "@/lib/training"

export function useController() {
  const three = useThreeStore((s) => s.three)
  const setTabByKey = useTabStore((s) => s.setTabByKey)
  const setIsTraining = useTrainingStore((s) => s.setIsTraining)
  // const selectedStore = useSelected() // TODO: set selected by key
  const controller = useMemo(() => {
    return { setTabByKey, setIsTraining, three }
  }, [setTabByKey, setIsTraining, three])
  return controller
}
