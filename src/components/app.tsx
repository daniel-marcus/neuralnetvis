"use client"

import { useTfBackend } from "@/model/tf-backend"
import { useDebugCommands } from "@/utils/debug"
import { Footer, Gradient, Menu, TileGrid } from "@/components"
import type { ReactNode } from "react"

export const App = ({ children }: { children?: ReactNode }) => {
  useTfBackend()
  useDebugCommands()
  return (
    <div>
      <Menu />
      <Gradient />
      <TileGrid />
      {children}
      <Footer />
    </div>
  )
}
