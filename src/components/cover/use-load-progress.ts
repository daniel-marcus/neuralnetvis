import { useEffect, useState } from "react"
import { useGlobalStore } from "@/store"

// models of all tiles that have started loading (near the viewport)
export function useLoadProgress() {
  const scenes = useGlobalStore((s) => s.scenes)
  const hasRenderer = useGlobalStore((s) => !!s.renderer)
  const [counts, setCounts] = useState({ total: 0, loaded: 0 })
  useEffect(() => {
    const update = () => {
      const loading = scenes.map((s) => s.getState()).filter((s) => s.shouldLoad)
      const total = loading.length
      const loaded = loading.filter((s) => !!s.model).length
      setCounts((old) => (old.total === total && old.loaded === loaded ? old : { total, loaded }))
    }
    update()
    const unsubs = scenes.map((s) => s.subscribe(update))
    return () => unsubs.forEach((unsub) => unsub())
  }, [scenes])
  const isReady = hasRenderer && counts.total > 0 && counts.loaded === counts.total
  return { ...counts, isReady }
}
