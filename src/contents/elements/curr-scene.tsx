import { SceneContext, useGlobalStore } from "@/store"
import type { ReactNode } from "react"

// lesson content lives outside of the SceneStoreProvider: provide the current scene to reuse scene components
export function CurrSceneProvider({ children }: { children: ReactNode }) {
  const scene = useGlobalStore((s) => s.scene)
  return <SceneContext.Provider value={scene}>{children}</SceneContext.Provider>
}
