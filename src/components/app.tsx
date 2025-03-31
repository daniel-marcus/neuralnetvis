"use client"

import { useTfBackend } from "@/model/tf-backend"
import { useDebugCommands } from "@/utils/debug"
import { Header, LessonGradient, TileGrid, StatusBar } from "@/components"
import type { ReactNode } from "react"

export const App = ({ children }: { children?: ReactNode }) => {
  useTfBackend()
  useDebugCommands()
  return (
    <>
      <Header />
      <div
        id="my-portal"
        className="absolute z-20 pointer-events-none top-0 left-0 w-[100vw]"
      />
      <TileGrid />
      {children}
      <LessonGradient />
      <StatusBar />
    </>
  )
}
