"use client"

import { useTfBackend } from "@/model/tf-backend"
import { useDebugCommands, useScreenshotBodyClass } from "@/utils/debug"
import { Header } from "./header"
import { LessonOverlayPortal } from "./lesson"
import { MainCanvas } from "./canvas"
import { TileGrid } from "./tile-grid"
import { StatusBar } from "./status-bar"

export const App = ({ children }: { children?: React.ReactNode }) => {
  useTfBackend()
  useDebugCommands()
  useScreenshotBodyClass()
  return (
    <>
      <Header />
      <LessonOverlayPortal />
      <MainCanvas />
      <TileGrid />
      {children}
      <StatusBar />
    </>
  )
}
