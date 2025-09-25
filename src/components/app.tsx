"use client"

import { useRef } from "react"
import { useTfBackend } from "@/model/tf-backend"
import { useDebugCommands } from "@/utils/debug"
import { useScreenshotBodyClass } from "@/utils/screenshot"
import { useResizeListener } from "@/utils/screen"
import { Header } from "./header"
import { LessonOverlayPortal } from "./lesson"
import { MainCanvas } from "./canvas"
import { TileGrid } from "./tile-grid"
import { StatusBar } from "./status-bar"

export const App = ({ children }: { children?: React.ReactNode }) => {
  useTfBackend()
  useDebugCommands()
  useScreenshotBodyClass()
  useResizeListener()
  const ref = useRef<HTMLDivElement>(null!)
  return (
    <div ref={ref}>
      <MainCanvas eventSource={ref} />
      <Header />
      <LessonOverlayPortal />
      <TileGrid />
      {children}
      <StatusBar />
    </div>
  )
}
