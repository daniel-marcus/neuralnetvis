import { LayerConfigArray } from "@/model"
import { useSceneStore } from "@/store"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import { moveCameraTo } from "./3d-model/utils"
import { defaultState } from "@/utils/initial-state"
import { useKeyCommand } from "@/utils/key-command"

const CAMERA_POS = [-40, 0, 0] as [number, number, number]
const CAMERA_LOOK_AT = [0, 0, 0] as [number, number, number]

export const LayerInspector = () => {
  const layers = useModelLayers()
  const [currLayer, setCurrLayer] = useLayersFilter(layers)
  const [isShown, setIsShown] = useState(true)
  useCameraPos(CAMERA_POS, CAMERA_LOOK_AT)
  useKeyboardNavigation(layers, setCurrLayer)
  // TODO: gradients for overscroll
  return (
    <div
      className={`fixed top-0 right-0 h-screen flex flex-col items-end justify-center pointer-events-none overflow-visible`}
    >
      <div
        className={`absolute top-0 right-0 ${
          isShown ? "opacity-100 sm:opacity-0" : "opacity-0"
        } bg-[radial-gradient(ellipse_at_right,var(--background),transparent_75%)] transition-opacity duration-200 w-[75vw] sm:w-[25vw] flex flex-col items-end justify-center h-full`}
      />
      <button
        className={`relative z-10 sm:hidden p-main text-right pointer-events-auto active:text-white`}
        onClick={() => setIsShown((s) => !s)}
      >
        {isShown ? "Layers >" : "< Layers"}
      </button>
      <ul
        className={`relative z-10 p-main max-h-[80vh] overflowscroll flex flex-col gap-2 sm:gap-4 text-right max-w-[300px] ${
          isShown ? "" : "translate-x-full sm:translate-x-0"
        } transition-transform duration-200`}
      >
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

function useLayersFilter(layers: LayerConfigArray) {
  const setVisConfig = useSceneStore((s) => s.vis.setConfig)
  const [currLayer, setCurrLayer] = useState(0)
  useEffect(() => {
    const invisibleLayers = layers
      .filter((_, i) => i !== currLayer)
      .map((l) => l.config.name)
      .filter(Boolean) as string[]
    setVisConfig({ invisibleLayers })
  }, [currLayer, layers, setVisConfig])

  useEffect(() => {
    return () => setVisConfig({ invisibleLayers: [] })
  }, [setVisConfig])

  return [currLayer, setCurrLayer] as const
}

function useModelLayers() {
  const model = useSceneStore((s) => s.model)
  const layers = useMemo(
    () => (model?.getConfig().layers ?? []) as unknown as LayerConfigArray,
    [model]
  )
  return layers
}

function useCameraPos(
  pos: [number, number, number],
  lookAt?: [number, number, number]
) {
  useEffect(() => {
    moveCameraTo(pos, lookAt)
    return () => {
      moveCameraTo(defaultState.cameraPos, defaultState.cameraLookAt)
    }
  }, [pos, lookAt])
}

function useKeyboardNavigation(
  layers: LayerConfigArray,
  setCurrLayer: React.Dispatch<React.SetStateAction<number>>
) {
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
    [layers, setCurrLayer]
  )
  const prev = useCallback(() => next(-1), [next])
  useKeyCommand("ArrowUp", prev)
  useKeyCommand("ArrowDown", next)
}

function isNotVisible(layer: LayerConfigArray[number]) {
  return ["Flatten", "Dropout"].includes(layer.className)
}
