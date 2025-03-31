"use client"

import { useTfBackend } from "@/model/tf-backend"
import { useDebugCommands } from "@/utils/debug"
import { useGlobalStore } from "@/store"
import { Header, LessonGradient, TileGrid, StatusBar } from "@/components"
import type { ReactNode } from "react"

export const App = ({ children }: { children?: ReactNode }) => {
  useTfBackend()
  useDebugCommands()
  return (
    <>
      <Header />
      <Portal />
      <TileGrid />
      {children}
      <LessonGradient />
      <StatusBar />
    </>
  )
}

function Portal() {
  const ref = useGlobalStore((s) => s.portalRef)
  return <div ref={ref} className="absolute z-20 pointer-events-none inset-0" />
}
