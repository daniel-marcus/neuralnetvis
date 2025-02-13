"use client"

import { useController } from "@/utils/controller"
import { useDatasetStore } from "@/data/data"
import { useVisConfigStore } from "@/scene/vis-config"
import { trainOnBatch, useTrainingStore } from "@/model/training"
import { useInitialState, type InitialState } from "@/utils/initial-state"
import { useStatusStore } from "@/components/status"
import { LockButton } from "@/scene/lock"
import { Block, Button, Details, Head } from "@/contents/elements"
import type {
  OnBlockEnterLeaveProps,
  OnBlockScrollProps,
} from "@/contents/elements/types"
import type { LessonContent } from "."
import { interpolateCamera, moveCameraTo } from "@/scene/utils"

const initialState: InitialState = {
  datasetKey: "mnist",
  layerConfigs: [
    { className: "Dense", config: { units: 64, activation: "relu" } },
    { className: "Dense", config: {} },
  ],
  cameraPos: [0, 0, 35],
}

export const IntroNetworks = (): LessonContent => {
  const controller = useController()
  useInitialState(initialState)
  return (
    <main>
      <Head
        title="How do networks learn?"
        description="Some basics about machine learning"
        onScroll={rotate}
      />
      <Block
        onScroll={({ percent }) =>
          interpolateCamera([0, 0, 41.6], [-30, 20, 50], percent)
        }
      >
        Just scroll and see what happens.
      </Block>
      <Block onScroll={changeSample}>
        Now let&apos;s change the sample as we scroll.
      </Block>
      <Block
        onScroll={scrollTrain}
        onLeave={() => useStatusStore.getState().setStatusText("", null)}
        className="pb-[100vh]"
      >
        We can even train the model as we scroll.
      </Block>
      <Block
        onEnter={() => moveCameraTo([-15, 0.5, 17], 1000)}
        onLeave={() => moveCameraTo([0, 0, 30])}
      >
        Move camera to a specific position
      </Block>
      <Block
        onEnter={() => moveCameraTo([-25, 24, 23])}
        onLeave={() => moveCameraTo([0, 0, 30])}
      >
        Another one!
      </Block>
      <Block onScroll={changeLayerSpacing}>Changing xShift</Block>
      <Block onScroll={changeNeuronSpacing}>Changing neuronSpacing</Block>
      <Block>
        Try out!
        <br />
        <br />
        <LockButton />
      </Block>
      <Block>
        What do you think?
        <br />
        <Details title="How does that work?">
          <p>Here is some extra content.</p>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam
            scelerisque ligula nec orci tincidunt, non venenatis ligula posuere.
            Integer facilisis, tortor eget lobortis gravida, felis justo
            tristique elit, sit amet tempor dui purus sed justo. Vivamus in
            mauris ut sem vehicula viverra. Ut et arcu ac tortor malesuada
            mollis. Morbi sed nunc gravida, cursus felis nec, iaculis eros. Sed
            euismod bibendum sem, ac gravida velit facilisis ut. Nulla facilisi.
            Sed feugiat varius quam, in volutpat ante eleifend nec.
          </p>
        </Details>
      </Block>
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

async function scrollTrain({ percent }: OnBlockScrollProps) {
  const totalSamples = useDatasetStore.getState().totalSamples
  const newI = Math.round(Math.random() * totalSamples - 1)
  useDatasetStore.setState({ i: newI })

  const input = useDatasetStore.getState().input
  const trainingY = useDatasetStore.getState().trainingY
  const setStatusText = useStatusStore.getState().setStatusText
  if (!input || !trainingY) return
  const metrics = await trainOnBatch([input], [trainingY])
  const loss = Array.isArray(metrics) ? metrics[0] : metrics
  setStatusText(`Training loss: ${loss?.toFixed(2)}`, percent)
}

function changeLayerSpacing({ percent }: OnBlockScrollProps) {
  const defaultSpacing = 11
  const scalingFactor = Math.sin(2 * Math.PI * percent) + 1
  const newSpacing = defaultSpacing * scalingFactor
  useVisConfigStore.setState({ xShift: newSpacing })
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
