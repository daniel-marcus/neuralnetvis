"use client"

import { getThree, setStatus, setVisConfig, useStore } from "@/store"
import { useInitialState, type InitialState } from "@/utils/initial-state"
import { LockButton } from "@/scene/lock"
import { Block, Details, Head } from "@/contents/elements"
import { LogsPlot } from "@/components/ui-elements/logs-plot"
import { trainOnBatch } from "@/model/training"
import { interpolate } from "@/scene/utils"
import type { OnScrollProps } from "@/contents/elements/types"
import type { LessonContent } from "."

const initialState: InitialState = {
  datasetKey: "mnist",
  layerConfigs: [{ className: "Dense", config: {} }], // the output layer
  cameraPos: [-1.6, 0, 2.7],
  sampleIdx: 50,
  vis: {
    neuronSpacing: 2,
    invisibleLayers: ["nnv_Output"],
  },
}

export const IntroNetworks = (): LessonContent => {
  useInitialState(initialState)
  return (
    <main>
      <Head
        title="How do networks learn?"
        description="Let's teach a machine to recognize handwritten digits"
        cameraPos={initialState.cameraPos}
        onScroll={({ percent }) => {
          const initSpacing = initialState.vis!.neuronSpacing!
          const neuronSpacing = interpolate(initSpacing, 1, percent)
          useStore.getState().vis.setConfig({ neuronSpacing })
        }}
      />
      <Block
        cameraPos={[-40, 0, 0]}
        onEnter={() => {
          useStore.setState({ sampleIdx: initialState.sampleIdx })
          setVisConfig({
            invisibleLayers: initialState.vis!.invisibleLayers,
          })
        }}
      >
        This is a three. No doubts.
      </Block>
      <Block
        cameraPos={[-25, 15, 30]}
        onEnter={() => {
          setVisConfig({ invisibleLayers: [] })
        }}
      >
        Let&apos;s add our output layer.
      </Block>
      <Block cameraPos={[-15, 10, 35]} onScroll={changeSample}>
        Now let&apos;s change the sample as we scroll.
      </Block>
      <Block
        onScroll={scrollTrain}
        onLeave={() => setStatus("", null)}
        className="h-[100vh] relative "
      >
        <p>We can even train the model as we scroll.</p>
        <div className="sticky top-0 pt-16 max-w-[32rem]">
          <LogsPlot />
        </div>
      </Block>
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
    </main>
  )
}

export function rotate({ percent }: OnScrollProps) {
  const three = getThree()
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

function changeSample({ percent }: OnScrollProps) {
  const sampleIdx = Math.round(percent * 100 + 1)
  useStore.setState({ sampleIdx })
}

let batch = 0
const trainedIs = new Set<number>()

function getRandomI(totalSamples: number) {
  let i = Math.round(Math.random() * totalSamples - 1)
  while (trainedIs.has(i)) {
    i = Math.round(Math.random() * totalSamples - 1)
  }
  trainedIs.add(i)
  return i
}

async function scrollTrain({ percent }: OnScrollProps) {
  const totalSamples = useStore.getState().totalSamples()
  const sampleIdx = getRandomI(totalSamples)
  batch++
  useStore.setState({ sampleIdx })

  const sample = useStore.getState().sample
  if (!sample) return
  const log = await trainOnBatch([sample.X], [sample.y])

  if (!log) return
  useStore.getState().addLogs([{ ...log, batch }])
  setStatus(`Training loss: ${log.loss.toFixed(2)}`, percent)
}
