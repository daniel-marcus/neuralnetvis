"use client"

import { useTfBackend } from "@/model/tf-backend"
import { useDebugCommands } from "@/utils/debug"
import { Gradient, Header, TileGrid, StatusBar } from "@/components"
import type { ReactNode } from "react"

export const App = ({ children }: { children?: ReactNode }) => {
  useTfBackend()
  useDebugCommands()
  return (
    <>
      <Header />
      <Gradient />
      <TileGrid />
      {children}
      <StatusBar />
    </>
  )
}
