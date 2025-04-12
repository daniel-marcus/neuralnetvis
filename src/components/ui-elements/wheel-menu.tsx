// inspiration: https://www.letsbuildui.dev/articles/a-rotating-word-wheel-interaction/

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react"
import { useKeyCommand } from "@/utils/key-command"
import type { SetterFunc } from "@/store"

const degPerItem = 6

type WheelMenuItem = { label: ReactNode; disabled?: boolean }
type Idx = number | undefined
type IdxSetter = (arg: Idx | SetterFunc<Idx>) => void

interface WheelMenuProps {
  items: WheelMenuItem[]
  currIdx: Idx
  setCurrIdx: IdxSetter
  onScroll?: () => void
  onScrollEnd?: () => void
}

export const WheelMenu = (props: WheelMenuProps) => {
  const [scrollerRef, wheelRotation, onClick] = useWheelInteractions(props)
  const hasCurrIdx = typeof props.currIdx === "number"
  return (
    <div
      ref={scrollerRef}
      className={`absolute top-0 right-0 w-[130px] sm:w-[190px] h-screen overflow-y-scroll overflow-x-clip pointer-events-auto text-sm sm:text-base ${
        !hasCurrIdx ? "translate-x-[calc(66%-2rem)] hover:translate-x-0" : ""
      } transition-transform duration-150 `}
    >
      <div
        className={`sticky top-[50vh] translate-x-[2rem] translate-y-[-50%] w-[calc(2*var(--wheel-radius))] h-[calc(2*var(--wheel-radius))] rounded-[50%] bg-box sm:bg-background shadow-accent-hover shadow-2xl flex items-center justify-center [--wheel-radius:450px]`}
      >
        <ul
          className={`flex items-center justify-center`}
          style={{ transform: `rotate(${wheelRotation}deg)` }}
        >
          {props.items.map(({ label, disabled }, i) => (
            <li
              key={i}
              className={`pl-2 sm:pl-4 absolute flex justify-start items-center origin-right translate-x-[calc(-0.5*var(--wheel-radius))] w-[var(--wheel-radius)]`}
              style={{ transform: `rotate(-${degPerItem * i}deg)` }}
            >
              <button
                data-active={i === props.currIdx || undefined}
                className={"data-active:text-white disabled:brightness-50"}
                onClick={() => onClick(i)}
                disabled={disabled}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="h-[200vh]" />
    </div>
  )
}

function useWheelInteractions(props: WheelMenuProps) {
  const { items, currIdx, setCurrIdx, onScroll, onScrollEnd } = props
  const [wheelRotation, setWheelRotation] = useState(0)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const jumpTarget = useRef<Idx>(undefined)

  const onClick = useCallback(
    (idx: number) => {
      const targetRotation = idx * degPerItem
      const percent = targetRotation / 360
      const scroller = scrollerRef.current
      setCurrIdx((oldIdx) => (idx === oldIdx ? undefined : idx))
      if (!scroller) return
      jumpTarget.current = idx
      const top = percent * (scroller.scrollHeight - scroller.clientHeight)
      scroller.scrollTo({ top, behavior: "smooth" })
      setTimeout(() => (jumpTarget.current = undefined), 500)
    },
    [setCurrIdx]
  )

  // onScroll: upd wheelRotation and currIdx + limit scrolling
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    let timeoutId: NodeJS.Timeout
    const handleScroll: EventListener = () => {
      const isHumanScroll = typeof jumpTarget.current === "undefined"

      if (isHumanScroll) {
        onScroll?.()
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => onScrollEnd?.(), 200)
      }

      if (!(scroller instanceof HTMLDivElement)) return
      const maxScrollTop = scroller.scrollHeight - scroller.clientHeight
      const percent = scroller.scrollTop / maxScrollTop

      const maxPercent = ((items.length - 1) * degPerItem) / 360
      if (percent > maxPercent) {
        scroller.scrollTop = maxPercent * maxScrollTop
        return
      }

      const newRotation = percent * 360
      setWheelRotation(newRotation)

      if (!isHumanScroll) return
      const newIdx = Math.round(newRotation / degPerItem)
      if (!!items[newIdx] && !items[newIdx].disabled) {
        setCurrIdx(newIdx)
      }
    }
    scroller.addEventListener("scroll", handleScroll)
    return () => scroller.removeEventListener("scroll", handleScroll)
  }, [setCurrIdx, items, onScroll, onScrollEnd])

  useKeyboardNavigation(currIdx, items, onClick)

  return [scrollerRef, wheelRotation, onClick] as const
}

function useKeyboardNavigation(
  currIdx: Idx,
  items: WheelMenuItem[],
  gotoIdx: (i: number) => void
) {
  const next = useCallback(
    (step = 1) => {
      const getNewIdx = (i: number) =>
        (((i + step) % items.length) + items.length) % items.length
      let newIdx = getNewIdx(currIdx ?? -1)
      while (items[newIdx]?.disabled) {
        newIdx = getNewIdx(newIdx)
      }
      gotoIdx(newIdx)
    },
    [currIdx, items, gotoIdx]
  )
  const prev = useCallback(() => next(-1), [next])
  useKeyCommand("ArrowUp", prev, true, true)
  useKeyCommand("ArrowDown", next, true, true)
}
