"use client"

import { ReactNode } from "react"
import { useDatasets } from "@/data/data"
import { useModel } from "@/model/model"
import { useTraining } from "@/model/training"
import { useInput } from "@/data/input"
import { useDebugCommands } from "@/utils/debug"
import { Scene } from "@/scene"
import { Menu } from "./menu"
import { Footer } from "./footer"
import { Gradient } from "./gradient"

export const App = ({ children }: { children?: ReactNode }) => {
  const ds = useDatasets()
  const model = useModel(ds)
  useTraining(model, ds)
  useInput(ds)
  useDebugCommands()
  return (
    <div>
      <Scene />
      <Footer />
      <Gradient />
      <Menu />
      {children}
    </div>
  )
}
