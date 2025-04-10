import { LayerConfigArray } from "@/model"
import { useSceneStore } from "@/store"
import { useCallback, useEffect, useMemo, useState } from "react"
import { moveCameraTo } from "./3d-model/utils"
import { defaultState } from "@/utils/initial-state"
import { useKeyCommand } from "@/utils/key-command"

const CAMERA_POS = [-40, 0, 0] as [number, number, number]

export const LayerInspector = () => {
  const model = useSceneStore((s) => s.model)
  const setVisConfig = useSceneStore((s) => s.vis.setConfig)
  const layers = useMemo(
    () => (model?.getConfig().layers ?? []) as unknown as LayerConfigArray,
    [model]
  )
  const [currLayer, setCurrLayer] = useState(0)
  useEffect(() => {
    const invisibleLayers = layers
      .filter((_, i) => i !== currLayer)
      .map((l) => l.config.name)
      .filter(Boolean) as string[]
    setVisConfig({ invisibleLayers })
  }, [currLayer, layers, setVisConfig])
  useEffect(() => {
    moveCameraTo(CAMERA_POS, [0, 0, 0])
    return () => {
      moveCameraTo(defaultState.cameraPos, defaultState.cameraLookAt)
      setVisConfig({ invisibleLayers: [] })
    }
  }, [setVisConfig])
  const next = useCallback(
    (step = 1) =>
      setCurrLayer((currIdx) => {
        const getNewIdx = (i: number) =>
          (((i + step) % layers.length) + layers.length) % layers.length
        let newIdx = getNewIdx(currIdx)
        while (isNotVisible(layers[newIdx])) {
          newIdx = getNewIdx(newIdx)
        }
        return newIdx
      }),
    [layers]
  )
  const prev = useCallback(() => next(-1), [next])
  useKeyCommand("ArrowUp", prev)
  useKeyCommand("ArrowDown", next)
  // TODO: gradients for overscroll
  return (
    <div
      className={`absolute top-0 right-0 h-screen max-w-[300px] flex flex-col items-start justify-center pointer-events-none`}
    >
      <ul className="max-h-[80vh] overflow-scroll flex flex-col gap-2 sm:gap-4 text-right p-main">
        {layers.map((l, i) => {
          const isCurrent = i === currLayer
          const notVisible = isNotVisible(l)
          return (
            <li
              key={i}
              className={`${
                notVisible
                  ? "brightness-50"
                  : isCurrent
                  ? "text-white"
                  : "cursor-pointer pointer-events-auto"
              }`}
              onClick={
                isCurrent || notVisible ? undefined : () => setCurrLayer(i)
              }
            >
              {l.className}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function isNotVisible(layer: LayerConfigArray[number]) {
  return ["Flatten", "Dropout"].includes(layer.className)
}
