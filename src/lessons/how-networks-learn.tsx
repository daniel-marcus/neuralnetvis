"use client"

import {
  Block,
  Button,
  OnBlockEnterLeaveProps,
  OnBlockScrollProps,
} from "@/components/lesson"
import { LessonContent } from "./all-lessons"
import { useEffect } from "react"
import { useController } from "@/lib/controller"
import { useDatasetStore } from "@/lib/datasets"
import { useVisConfigStore } from "@/lib/vis-config"
import { useTrainingStore } from "@/lib/training"

export const IntroNetworks = (): LessonContent => {
  const controller = useController()
  useEffect(() => {
    console.log("IntroNetworks mounted")
  }, [])
  return (
    <main>
      <Block onScroll={rotate}>Just scroll and see what happens.</Block>
      <Block onScroll={changeSample}>
        Now let&apos;s change the sample as we scroll.
      </Block>
      <Block onScroll={changeLayerSpacing}>Changing layerSpacing.</Block>
      <Block onScroll={changeNeuronSpacing}>Changing neuronSpacing</Block>
      <Block>
        How about training?
        <br />
        <br />
        <Button onClick={() => startTraining(controller)}>Train!</Button>
      </Block>
    </main>
  )
}

function rotate({ three, percent }: OnBlockScrollProps) {
  if (!three) return
  const camera = three.camera
  function rotate(percent: number) {
    const angle = percent * Math.PI * 2 // Full rotation
    const radius = Math.sqrt(22.5 * 22.5 + 35 * 35) // Distance from origin
    camera.position.x = Math.sin(angle) * radius
    camera.position.z = Math.cos(angle) * radius
    camera.lookAt(0, 0, 0)
    three?.invalidate()
  }
  rotate(percent)
}

function changeSample({ percent }: OnBlockScrollProps) {
  const newI = Math.round(percent * 100 + 1)
  useDatasetStore.setState({ i: newI })
}

function changeLayerSpacing({ percent }: OnBlockScrollProps) {
  const defaultSpacing = 11
  const scalingFactor = Math.sin(2 * Math.PI * percent) + 1
  const newSpacing = defaultSpacing * scalingFactor
  useVisConfigStore.setState({ layerSpacing: newSpacing })
}

function changeNeuronSpacing({ percent }: OnBlockScrollProps) {
  const defaultSpacing = 1.1
  const scalingFactor = Math.sin(2 * Math.PI * percent) + 1
  const newSpacing = defaultSpacing * scalingFactor
  useVisConfigStore.setState({ neuronSpacing: newSpacing })
}

function startTraining({ setIsTraining, setTabByKey }: OnBlockEnterLeaveProps) {
  useTrainingStore.getState().setConfig({ silent: false })
  setTabByKey("training")
  setIsTraining(true)
}
