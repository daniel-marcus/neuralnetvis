import { LayerConfigArray } from "@/model"
import { useSceneStore } from "@/store"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { moveCameraTo } from "./3d-model/utils"
import { defaultState } from "@/utils/initial-state"
import { useKeyCommand } from "@/utils/key-command"

const CAMERA_POS = [-23, 0, 35] as [number, number, number]
const CAMERA_LOOK_AT = [0, 0, 0] as [number, number, number]

const WHEEL_DEG = 45

export const LayerInspector = () => {
  const layers = useModelLayers()
  const [currLayer, setCurrLayer] = useLayersFilter(layers)
  const [isShown] = useState(true)
  useCameraPos(CAMERA_POS, CAMERA_LOOK_AT)
  useKeyboardNavigation(layers, setCurrLayer)
  // TODO: gradients for overscroll
  const [wheelRotation, setWheelRotation] = useState(0)
  const [enableTransition, setEnableTransition] = useState(false)

  const handleClick = (layerIdx: number) => {
    const newRotation = (WHEEL_DEG / layers.length) * (layerIdx ?? 0)
    setEnableTransition(true)
    setCurrLayer(layerIdx)
    setWheelRotation(newRotation)
    // TODO: set scroll pos
    setTimeout(() => {
      setEnableTransition(false)
    }, 200)
  }
  const scrollerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const onScroll = () => {
      if (!(scroller instanceof HTMLDivElement)) return
      const percent = Math.min(1, scroller.scrollTop / scroller.clientHeight)
      const newRotation = percent * WHEEL_DEG

      const currItem = Math.floor((newRotation / WHEEL_DEG) * layers.length)
      if (currItem !== currLayer && !isNotVisible(layers[currItem])) {
        setCurrLayer(currItem)
      }

      setWheelRotation(newRotation)
    }
    scroller.addEventListener("scroll", onScroll)
    return () => {
      scroller.removeEventListener("scroll", onScroll)
    }
  }, [currLayer, setCurrLayer, layers])
  return (
    <div
      className={`fixed _border-1 top-0 right-0 h-screen flex flex-col items-start justify-center pointer-events-none overflow-visible`}
    >
      <div
        className={`absolute top-0 right-0 ${
          isShown ? "opacity-100 sm:opacity-0" : "opacity-0"
        } bg-[radial-gradient(ellipse_at_right,var(--background),transparent_75%)] transition-opacity duration-200 w-[75vw] sm:w-[25vw] flex flex-col items-end justify-center h-full`}
      />
      <div
        ref={scrollerRef}
        className="absolute top-0 right-0 w-[300px] h-screen overflow-scroll pointer-events-auto"
      >
        <ul
          className={`fixed top-[50vh] right-0 translate-y-[-50%] max-h-[80vh] translate-x-[400px] ${
            enableTransition ? "transition-transform duration-200" : ""
          } flex items-center justify-center w-[1rem] h-[1rem] rounded-[50%] border-1 bg-accent border-accent`}
          style={{
            transform: `rotate(${wheelRotation}deg)`,
          }}
        >
          {layers.map((l, i) => {
            const degPerItem = WHEEL_DEG / layers.length
            const rotation = degPerItem * i
            const isCurrent = i === currLayer
            const notVisible = isNotVisible(l)
            return (
              <li
                key={i}
                className={`absolute flex justify-start items-center _border-1 translate-[0px] w-[1100px] ${
                  notVisible
                    ? "brightness-50"
                    : isCurrent
                    ? "text-white"
                    : "cursor-pointer"
                }`}
                onClick={
                  isCurrent || notVisible
                    ? () => setCurrLayer(undefined)
                    : () => handleClick(i)
                }
                style={{
                  transform: `rotate(-${rotation}deg)`,
                }}
              >
                {l.className}
              </li>
            )
          })}
        </ul>
        <div className="h-[200vh]" />
      </div>
    </div>
  )
}

function useLayersFilter(layers: LayerConfigArray) {
  const setVisConfig = useSceneStore((s) => s.vis.setConfig)
  const currLayer = useSceneStore((s) => s.focussedLayerIdx)
  const setCurrLayer = useSceneStore((s) => s.setFocussedLayerIdx)

  // const [currLayer, setCurrLayer] = useState(0)
  useEffect(() => {
    const invisibleLayers =
      typeof currLayer === "number"
        ? (layers
            .filter((_, i) => i !== currLayer)
            .map((l) => l.config.name)
            .filter(Boolean) as string[])
        : []
    setVisConfig({ invisibleLayers })
  }, [currLayer, layers, setVisConfig])

  useEffect(() => {
    setCurrLayer(0)
    const actEl = document.activeElement
    if (actEl && actEl instanceof HTMLElement) actEl.blur()
    return () => {
      setVisConfig({ invisibleLayers: [] })
      setCurrLayer(undefined)
    }
  }, [setVisConfig, setCurrLayer])

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
  setCurrLayer: React.Dispatch<React.SetStateAction<number | undefined>>
) {
  const next = useCallback(
    (step = 1) =>
      setCurrLayer((currIdx) => {
        const getNewIdx = (i: number) =>
          (((i + step) % layers.length) + layers.length) % layers.length
        let newIdx = getNewIdx(currIdx ?? -1)
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
