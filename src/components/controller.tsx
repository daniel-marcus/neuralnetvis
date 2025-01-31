import { useEffect } from "react"
import { useControlStores } from "./controls"
import { useTabsStore } from "./menu"
import { useThree } from "@react-three/fiber"

declare global {
  interface Window {
    controller: unknown
  }
}

// TODO: setDatasetByKey ?

export const Controller = () => {
  const three = useThree()
  const stores = useControlStores()
  const tabs = useTabsStore()
  useEffect(() => {
    const controller = { ...stores, tabs, three }
    window.controller = controller
  }, [stores, tabs, three])
  return null
}
