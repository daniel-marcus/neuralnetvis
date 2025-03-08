"use client"

import { useGlobalStore } from "@/store"
import { useTfBackend } from "@/model/tf-backend"
import { useTraining } from "@/model"
import { useDebugCommands } from "@/utils/debug"
import { Footer, Gradient, Menu, TileGrid } from "@/components"
import type { ReactNode } from "react"

export const App = ({ children }: { children?: ReactNode }) => {
  useTfBackend()
  const ds = useGlobalStore((s) => s.ds)
  const model = useGlobalStore((s) => s.model)
  useTraining(model, ds)
  useDebugCommands()
  return (
    <div>
      <Footer />
      <Gradient />
      <Menu />
      <TileGrid />
      {children}
    </div>
  )
}
