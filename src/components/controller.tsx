import { useEffect, useMemo } from "react"
import { useControlStores } from "./controls"
import { useTabStore } from "./menu"
import { useThreeStore } from "@/lib/three-store"
import { useTrainingStore } from "@/lib/training"

declare global {
  interface Window {
    controller: unknown
  }
}

export function useController() {
  const three = useThreeStore((s) => s.three)
  const controlStores = useControlStores()
  const setTabByKey = useTabStore((s) => s.setTabByKey)
  const setIsTraining = useTrainingStore((s) => s.setIsTraining)
  // const selectedStore = useSelected() // TODO: set selected by key
  const controller = useMemo(() => {
    console.log("controller changed")
    return { ...controlStores, setTabByKey, setIsTraining, three }
  }, [controlStores, setTabByKey, setIsTraining, three])
  return controller
}

export const Controller = () => {
  const controller = useController()
  useEffect(() => {
    window.controller = controller
  }, [controller])
  return null
}
