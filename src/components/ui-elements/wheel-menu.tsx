// inspiration: https://www.letsbuildui.dev/articles/a-rotating-word-wheel-interaction/

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react"
import { useKeyCommand } from "@/utils/key-command"
import type { SetterFunc } from "@/store"

const DEFAULT_DEG_PER_ITEM = 6

type WheelMenuItem = { label: ReactNode; disabled?: boolean }
type Idx = number | undefined
type IdxSetter = (arg: Idx | SetterFunc<Idx>) => void

interface WheelMenuProps {
  items: WheelMenuItem[]
  currIdx: Idx
  setCurrIdx: IdxSetter
  onScrollStart?: () => void
  onScrollEnd?: () => void
  autoHide?: boolean
}

export const WheelMenu = (props: WheelMenuProps) => {
  const degPerItem = Math.min(DEFAULT_DEG_PER_ITEM, 356 / props.items.length)
  const [scrollerRef, wheelRef, rotation, onClick, isActive] =
    useWheelInteractions(props, degPerItem)
  return (
    <div
      ref={scrollerRef} // hidden scroll container
      className={`absolute top-0 right-[-10px] h-screen overflow-y-scroll pointer-events-auto select-none no-scrollbar w-[10px]`}
    >
      <div
        className={`fixed right-0 top-[50vh] translate-y-[-50%] w-[calc(2*var(--wheel-radius))] h-[calc(2*var(--wheel-radius))] rounded-[50%] bg-background shadow-accent-hover shadow-2xl after:absolute after:inset-0 after:rounded-[50%] after:shadow-accent after:shadow-xl after:transition-opacity after:duration-200 after:z-[-1] ${
          !props.items.length
            ? "translate-x-full after:opacity-0"
            : isActive
            ? "after:opacity-100 translate-x-[calc(100%-105px)] sm:translate-x-[calc(100%-125px)]"
            : "after:opacity-0 translate-x-[calc(100%-40px)] sm:translate-x-[calc(100%-80px)] hover:translate-x-[calc(100%-125px)]"
        } transition-transform duration-200 flex items-center justify-center [--wheel-radius:450px] select-none`}
        ref={wheelRef}
      >
        <ul
          className={`flex items-center justify-center`}
          style={{ transform: `rotate(${rotation.toFixed(2)}deg)` }}
        >
          {props.items.map(({ label, disabled }, i) => {
            const isActive = i === props.currIdx
            return (
              <li
                key={i}
                className={`absolute flex justify-start items-center origin-right translate-x-[calc(-0.5*var(--wheel-radius))] w-[var(--wheel-radius)]`}
                style={{ transform: `rotate(-${degPerItem * (i + 1)}deg)` }}
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
      <div className="h-[300vh]" />
    </div>
  )
}

function useWheelInteractions(props: WheelMenuProps, degPerItem: number) {
  const { items, currIdx, setCurrIdx, onScrollStart, onScrollEnd, autoHide } =
    props
  const [isActive, setIsActive] = useState(!autoHide)
  const [wheelRotation, setWheelRotation] = useState(0)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const wheelRef = useRef<HTMLDivElement>(null)
  const jumpTarget = useRef<Idx>(undefined)
  const userInteraction = useRef(false)

  const onClick = useCallback(
    (idx: number) => setCurrIdx((oldIdx) => (idx === oldIdx ? undefined : idx)),
    [setCurrIdx]
  )

  // on external currIdx change: auto scroll to the target item
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller || userInteraction.current) return
    const targetIdx = currIdx ?? -1
    const targetRotation = (targetIdx + 1) * degPerItem // +1 because 0 is empty (unselect)
    const percent = targetRotation / 360
    jumpTarget.current = targetIdx
    const top = percent * getMaxScroll(scroller)
    scroller.scrollTo({ top, behavior: "smooth" })
  }, [currIdx, degPerItem])

  // set up event listeners
  useEffect(() => {
    const scroller = scrollerRef.current
    const wheel = wheelRef.current
    if (!scroller || !wheel) return

    const startScroll = () => {
      jumpTarget.current = undefined
      userInteraction.current = true
      setIsActive(true)
      onScrollStart?.()
    }
    const endScroll = () => {
      userInteraction.current = false
      if (autoHide) setIsActive(false)
      onScrollEnd?.()
    }

    const handleScroll: EventListener = () => {
      if (!(scroller instanceof HTMLDivElement)) return

      // limit scroll and update wheel rotation
      const maxScrollTop = getMaxScroll(scroller)
      const maxPercent = (items.length * degPerItem) / 360
      const percent = scroller.scrollTop / maxScrollTop
      if (percent > maxPercent) {
        scroller.scrollTop = maxPercent * maxScrollTop
        return
      }
      const newRotation = percent * 360
      setWheelRotation(newRotation)

      // update currIdx for human scroll
      const isHumanScroll = typeof jumpTarget.current === "undefined"
      const newIdx = Math.round((newRotation - degPerItem) / degPerItem)
      if (isHumanScroll && !items[newIdx]?.disabled)
        setCurrIdx(!!items[newIdx] ? newIdx : undefined)
    }

    let startY: number | null = null
    let startScrollTop: number = 0
    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY
      startScrollTop = scroller.scrollTop
      if (
        (e.target instanceof HTMLElement &&
          ["BUTTON", "SPAN"].includes(`${e.target.tagName}`)) ||
        e.touches.length >= 2
      )
        return
      e.preventDefault()
      setIsActive(true)
    }
    const onTouchMove = rafThrottle((e: TouchEvent) => {
      if (!userInteraction.current) startScroll()
      if (e.touches.length === 1 && startY !== null) {
        const currentY = e.touches[0].clientY
        const deltaY = currentY - startY
        scroller.scrollTop = startScrollTop - deltaY
        e.preventDefault()
      }
    })

    let wheelEndTimeout: NodeJS.Timeout
    const handleWheel = (e: WheelEvent) => {
      if (!userInteraction.current) startScroll()
      clearTimeout(wheelEndTimeout)
      wheelEndTimeout = setTimeout(endScroll, 300)
      scroller.scrollTop += e.deltaY
    }

    scroller.addEventListener("scroll", handleScroll)
    wheel.addEventListener("wheel", handleWheel)
    wheel.addEventListener("touchstart", onTouchStart)
    wheel.addEventListener("touchmove", onTouchMove)
    wheel.addEventListener("touchend", endScroll)
    return () => {
      scroller.removeEventListener("scroll", handleScroll)
      wheel.removeEventListener("wheel", handleWheel)
      wheel.removeEventListener("touchstart", onTouchStart)
      wheel.removeEventListener("touchmove", onTouchMove)
      wheel.removeEventListener("touchend", endScroll)
    }
  }, [setCurrIdx, items, onScrollStart, onScrollEnd, autoHide, degPerItem])

  useKeyboardNavigation(currIdx, items, onClick)

  return [scrollerRef, wheelRef, wheelRotation, onClick, isActive] as const
}

function getMaxScroll(scroller: HTMLDivElement) {
  return scroller.scrollHeight - scroller.clientHeight
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

// returns a funtion that is throttled by requestAnimationFrame
function rafThrottle<T extends (...args: never[]) => void>(
  fn: T
): (...args: Parameters<T>) => void {
  let ticking = false
  let lastArgs: Parameters<T>

  return function (...args: Parameters<T>) {
    lastArgs = args
    if (!ticking) {
      ticking = true
      requestAnimationFrame(() => {
        fn(...lastArgs)
        ticking = false
      })
    }
  }
}
