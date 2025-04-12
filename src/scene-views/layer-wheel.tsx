import { LayerConfigArray } from "@/model"
import { useSceneStore } from "@/store"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useKeyCommand } from "@/utils/key-command"

const degPerItem = 6

export const LayerWheel = () => {
  const layers = useModelLayers()
  const [currLayer, setCurrLayer] = useLayersFilter(layers)
  const [wheelRotation, setWheelRotation] = useState(0)
  const hasFocussed = typeof currLayer === "number"

  // TODO: hidde btn for mobile

  const scrollerRef = useRef<HTMLDivElement>(null)
  const jumpTarget = useRef<number | undefined>(undefined)

  const handleClick = useCallback(
    (layerIdx: number) => {
      const targetRotation = layerIdx * degPerItem
      const percent = targetRotation / 360
      const scroller = scrollerRef.current
      setCurrLayer(layerIdx)
      if (scroller) {
        jumpTarget.current = layerIdx
        scroller.scrollTo({
          top: percent * (scroller.scrollHeight - scroller.clientHeight),
          behavior: "smooth",
        })
        setTimeout(() => {
          jumpTarget.current = undefined
        }, 500)
      }
    },
    [setCurrLayer]
  )

  useKeyboardNavigation(currLayer, layers, handleClick)

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const onScroll: EventListener = () => {
      if (!(scroller instanceof HTMLDivElement)) return
      const percent =
        scroller.scrollTop / (scroller.scrollHeight - scroller.clientHeight)

      const maxPercent = ((layers.length - 1) * degPerItem) / 360
      if (percent > maxPercent) {
        const maxScroll =
          maxPercent * (scroller.scrollHeight - scroller.clientHeight)
        scroller.scrollTop = maxScroll
        return
      }
      const newRotation = percent * 360
      const newIdx = Math.round(newRotation / degPerItem)
      if (
        (typeof jumpTarget.current === "undefined" ||
          jumpTarget.current === newIdx) &&
        newIdx !== currLayer &&
        !!layers[newIdx] &&
        !isNotVisible(layers[newIdx])
      ) {
        setCurrLayer(newIdx)
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
      className={`fixed top-0 right-0 h-screen flex flex-col items-start justify-center pointer-events-none overflow-visible`}
    >
      <div
        ref={scrollerRef}
        className={`absolute top-0 right-0 w-[130px] sm:w-[190px] h-screen overflow-y-scroll overflow-x-clip pointer-events-auto text-sm sm:text-base ${
          !hasFocussed ? "translate-x-[calc(66%-2rem)] hover:translate-x-0" : ""
        } transition-transform duration-200 `}
      >
        <div
          className={`sticky top-[50vh] translate-x-[2rem] translate-y-[-50%] w-[calc(2*var(--wheel-radius))] h-[calc(2*var(--wheel-radius))] rounded-[50%] bg-background shadow-accent-hover shadow-2xl flex items-center justify-center [--wheel-radius:450px]`}
        >
          <ul
            className={`flex items-center justify-center`}
            style={{
              transform: `rotate(${wheelRotation}deg)`,
            }}
          >
            {layers.map((l, i) => {
              const rotation = degPerItem * i
              const isCurrent = i === currLayer
              const notVisible = isNotVisible(l)
              return (
                <li
                  key={i}
                  className={`pl-2 sm:pl-4 absolute flex justify-start items-center origin-right translate-x-[calc(-0.5*var(--wheel-radius))] w-[var(--wheel-radius)] ${
                    notVisible ? "brightness-50" : ""
                  } ${isCurrent ? "text-white" : ""}`}
                  style={{
                    transform: `rotate(-${rotation}deg)`,
                  }}
                >
                  <button
                    className="pointer-events-auto"
                    onClick={
                      isCurrent || notVisible
                        ? () => setCurrLayer(undefined)
                        : () => handleClick(i)
                    }
                  >
                    {l.className}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
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

function useKeyboardNavigation(
  currIdx: number | undefined,
  layers: LayerConfigArray,
  gotoIdx: (i: number) => void
) {
  const next = useCallback(
    (step = 1) => {
      const getNewIdx = (i: number) =>
        (((i + step) % layers.length) + layers.length) % layers.length
      let newIdx = getNewIdx(currIdx ?? -1)
      while (isNotVisible(layers[newIdx])) {
        newIdx = getNewIdx(newIdx)
      }
      gotoIdx(newIdx)
    },
    [currIdx, layers, gotoIdx]
  )
  const prev = useCallback(() => next(-1), [next])
  useKeyCommand("ArrowUp", prev, true, true)
  useKeyCommand("ArrowDown", next, true, true)
}

function isNotVisible(layer: LayerConfigArray[number]) {
  return ["Flatten", "Dropout"].includes(layer.className)
}
