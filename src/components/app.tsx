"use client"

import { useTfBackend } from "@/model/tf-backend"
import { useDebugCommands } from "@/utils/debug"
import { Gradient, Menu, TileGrid } from "@/components"
import type { ReactNode } from "react"
import { StatusBar } from "./status"

export const App = ({ children }: { children?: ReactNode }) => {
  useTfBackend()
  useDebugCommands()
  return (
    <>
      <Menu />
      <Gradient />
      <TileGrid />
      {children}
      <StatusBar />
    </>
  )
}
