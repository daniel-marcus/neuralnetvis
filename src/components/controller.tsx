import { useEffect, useMemo } from "react"
import { useControlStores } from "./controls"
import { useTabsStore } from "./menu"
import { useThreeStore } from "@/lib/three-store"

declare global {
  interface Window {
    controller: unknown
  }
}

export function useController() {
  const three = useThreeStore((s) => s.three)
  const stores = useControlStores()
  const tabs = useTabsStore()
  const controller = useMemo(
    () => ({ ...stores, tabs, three }),
    [stores, tabs, three]
  )
  return controller
}

export const Controller = () => {
  const controller = useController()
  useEffect(() => {
    window.controller = controller
  }, [controller])
  return null
}
