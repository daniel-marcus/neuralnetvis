// inspiration: https://www.letsbuildui.dev/articles/a-rotating-word-wheel-interaction/

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react"
import { useKeyCommand } from "@/utils/key-command"
import { isTouch } from "@/utils/screen"
import type { SetterFunc } from "@/store"

const DEFAULT_DEG_PER_ITEM = 6

type WheelMenuItem = { label: ReactNode; disabled?: boolean }
type Idx = number | undefined
type IdxSetter = (arg: Idx | SetterFunc<Idx>) => void

interface WheelMenuProps {
  items: WheelMenuItem[]
  currIdx: Idx
  setCurrIdx: IdxSetter
  onScroll?: () => void
  onScrollEnd?: () => void
  autoHide?: boolean
}

export const WheelMenu = (props: WheelMenuProps) => {
  const degPerItem = Math.min(DEFAULT_DEG_PER_ITEM, 356 / props.items.length)
  const [ref, rotation, onClick, isActive] = useWheelInteractions(
    props,
    degPerItem
  )
  return (
    <div
      ref={ref}
      className={`absolute top-0 right-0 w-[140px] sm:w-[190px] h-screen overflow-y-scroll overflow-x-clip pointer-events-auto ${
        !isActive ? "translate-x-[calc(70%-2rem)] hover:translate-x-0" : ""
      } transition-transform duration-150 select-none no-scrollbar`}
    >
      <div
        className={`sticky top-[50vh] translate-x-[2rem] translate-y-[-50%] w-[calc(2*var(--wheel-radius))] h-[calc(2*var(--wheel-radius))] rounded-[50%] bg-background shadow-accent-hover shadow-2xl flex items-center justify-center [--wheel-radius:450px]`}
      >
        <ul
          className={`flex items-center justify-center`}
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {props.items.map(({ label, disabled }, i) => {
            const isActive = i === props.currIdx
            return (
              <li
                key={i}
                className={`absolute flex justify-start items-center origin-right translate-x-[calc(-0.5*var(--wheel-radius))] w-[var(--wheel-radius)]`}
                style={{ transform: `rotate(-${degPerItem * i}deg)` }}
              >
                <button onClick={() => onClick(i)} disabled={disabled}>
                  <span
                    className={`${
                      isActive ? "text-accent" : "brightness-25"
                    } px-1`}
                  >
                    •
                  </span>
                  <span
                    className={`${
                      isActive ? "text-white" : disabled ? "brightness-50" : ""
                    }`}
                  >
                    {label}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
      <div className="h-[calc(200vh+1000px)]" />
    </div>
  )
}

function useWheelInteractions(props: WheelMenuProps, degPerItem: number) {
  const { items, currIdx, setCurrIdx, onScroll, onScrollEnd, autoHide } = props
  const [isActive, setIsActive] = useState(!autoHide)
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
      const top = percent * getMaxScroll(scroller)
      scroller.scrollTo({ top, behavior: "smooth" })
      setTimeout(() => (jumpTarget.current = undefined), 500)
    },
    [setCurrIdx, degPerItem]
  )

  // onScroll: upd wheelRotation and currIdx + limit scrolling
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    let scrollEndTimeout: NodeJS.Timeout
    const handleScroll: EventListener = () => {
      const isHumanScroll =
        typeof jumpTarget.current === "undefined" && scroller.scrollTop > 0

      if (isHumanScroll && !isTouch()) {
        setIsActive(true)
        onScroll?.()
        clearTimeout(scrollEndTimeout)
        scrollEndTimeout = setTimeout(() => {
          if (autoHide) setIsActive(false)
          onScrollEnd?.()
        }, 300)
      }

      if (!(scroller instanceof HTMLDivElement)) return
      const maxScrollTop = getMaxScroll(scroller)
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

    const onTouchStart = (e: TouchEvent) => {
      if (
        (e.target instanceof HTMLElement &&
          ["BUTTON", "SPAN"].includes(`${e.target.tagName}`)) ||
        e.touches.length >= 2
      )
        return
      setIsActive(true)
    }
    const onTouchEnd = () => {
      if (autoHide) setIsActive(false)
      if (jumpTarget.current !== -1) {
        onScrollEnd?.()
      }
    }
    const onTouchMove = () => {
      if (scroller.scrollTop < -20) {
        setCurrIdx(undefined)
        jumpTarget.current = -1
        clearTimeout(scrollEndTimeout)
        scrollEndTimeout = setTimeout(
          () => (jumpTarget.current = undefined),
          500
        )
        return
      }
      onScroll?.()
      setIsActive(true)
    }

    scroller.addEventListener("scroll", handleScroll)
    scroller.addEventListener("touchstart", onTouchStart)
    scroller.addEventListener("touchmove", onTouchMove)
    scroller.addEventListener("touchend", onTouchEnd)
    return () => {
      scroller.removeEventListener("scroll", handleScroll)
      scroller.removeEventListener("touchstart", onTouchStart)
      scroller.removeEventListener("touchmove", onTouchMove)
      scroller.removeEventListener("touchend", onTouchEnd)
    }
  }, [setCurrIdx, items, onScroll, onScrollEnd, autoHide, degPerItem])

  useKeyboardNavigation(currIdx, items, onClick)

  return [scrollerRef, wheelRotation, onClick, isActive] as const
}

const SCROLL_PADDING = 1000 // px; to keep wheel always fixed (although it is "sticky")

function getMaxScroll(scroller: HTMLDivElement) {
  return scroller.scrollHeight - scroller.clientHeight - SCROLL_PADDING
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
