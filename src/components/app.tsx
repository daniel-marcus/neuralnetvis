"use client"

import { useStore } from "@/store"
import { useModel, useTraining } from "@/model"
import { useSample } from "@/data"
import { useDebugCommands } from "@/utils/debug"
import { VideoWindow } from "./video"
// import { Scene } from "@/scene"
import { Footer, Gradient, Menu } from "@/components"
import type { ReactNode } from "react"

export const App = ({ children }: { children?: ReactNode }) => {
  const ds = useStore((s) => s.ds)
  const model = useModel(ds)
  useTraining(model, ds)
  useSample(ds)
  useDebugCommands()
  return (
    <div>
      {ds?.hasCam && <VideoWindow />}

      <Footer />
      <Gradient />
      <Menu />
      {children}
    </div>
  )
}
