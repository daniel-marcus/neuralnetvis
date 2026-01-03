"use client"

import { useTfBackend } from "@/model/tf-backend"
import { useDebugCommands } from "@/utils/debug"
import { useScreenshotBodyClass } from "@/utils/screenshot"
import { useResizeListener } from "@/utils/screen"
import { useDomRefs } from "@/utils/dom-refs"
import { Header } from "./header"
import { LessonOverlayPortal } from "./lesson"
import { MainCanvas } from "./main-canvas"
import { TileGrid } from "./tile-grid"
import { StatusBar } from "./status-bar"

export const App = ({ children }: { children?: React.ReactNode }) => {
  useTfBackend()
  useDebugCommands()
  useScreenshotBodyClass()
  useResizeListener()
  const { rootRef } = useDomRefs()
  return (
    <div ref={rootRef}>
      <MainCanvas eventSource={rootRef} />
      <Header />
      <LessonOverlayPortal />
      <TileGrid />
      {children}
      <StatusBar />
    </div>
  )
}
