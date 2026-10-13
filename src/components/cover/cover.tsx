"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import * as tf from "@tensorflow/tfjs"
import { useGlobalStore } from "@/store"
import { useDomRefs } from "@/utils/dom-refs"
import { useKeyCommand } from "@/utils/key-command"
import { useDidMount } from "@/utils/helpers"
import { getAsciiBlur, getAsciiText } from "@/components/ui-elements/ascii-text"
import { ExtLink } from "@/components/ui-elements/buttons"
import { metadata } from "@/app/metadata"
import { useLoadProgress } from "./use-load-progress"
import type { CSSProperties } from "react"

const CoverScene = dynamic(() => import("./cover-scene"), { ssr: false })

const LEAVE_DURATION = 900 // ms
const HORIZON = 0.5 // share of the screen height above the horizon of the scene

const WORDS = ["Neural", "Net", "Vis"] // as in Logo
const LOGO_COLS = 78 // "Neural" and "Net Vis" have the same width
const WORD_GAP = 7 // columns between "Net" and "Vis", as in "Net Vis"

export function useIsCoverOpen() {
  const introDone = useGlobalStore((s) => s.introDone)
  return usePathname() === "/" && !introDone
}

// only for the first page load on "/": afterwards the tile grid is the start page
export function useSkipCover() {
  const pathname = usePathname()
  useEffect(() => {
    if (pathname !== "/") useGlobalStore.setState({ introDone: true })
  }, [pathname])
}

/**
 * Intro page that covers the tile grid while the models are loading in the background.
 * Rendered from the page (outside of App), so that it is part of the static HTML.
 */
export function Cover() {
  const introDone = useGlobalStore((s) => s.introDone)
  const [ref, isHydrated] = useDidMount<HTMLDivElement>()
  const [leave, setLeave] = useState<{ transforms?: string[] }>()
  const isLeaving = !!leave
  const hasStarted = useRef(false) // a key on the focused button triggers both click and key command
  const wordRefs = useRef<(HTMLDivElement | null)[]>([])
  const { logoRef } = useDomRefs()

  useEffect(() => {
    const isScreenshot = new URLSearchParams(window.location.search).has("screenshot")
    if (isScreenshot) useGlobalStore.setState({ introDone: true })
  }, [])

  useEffect(() => {
    if (introDone) return
    document.body.classList.add("overflow-hidden")
    return () => document.body.classList.remove("overflow-hidden")
  }, [introDone])

  const start = useCallback(() => {
    if (hasStarted.current) return
    hasStarted.current = true
    window.scrollTo(0, 0)
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const targets = [...(logoRef.current?.querySelectorAll("pre") ?? [])]
    const hasTargets = targets.length === WORDS.length && !reducedMotion
    // move the words to their counterparts in the header logo
    const transforms = hasTargets
      ? targets.map((target, i) => {
          const word = wordRefs.current[i]
          if (!word) return ""
          const from = word.getBoundingClientRect()
          const to = target.getBoundingClientRect()
          // same text, but different line heights (and the target is stretched to the logo width)
          const scaleX = getFontSize(target) / getFontSize(word)
          const scaleY = to.height / from.height
          return `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${scaleX}, ${scaleY})`
        })
      : undefined
    setLeave({ transforms })
    setTimeout(() => useGlobalStore.setState({ introDone: true }), LEAVE_DURATION)
  }, [logoRef])
  useKeyCommand("Enter", start, isHydrated && !introDone)
  useKeyCommand(" ", start, isHydrated && !introDone, true)

  if (introDone) return null
  const fade = `transition-opacity duration-(--leave-duration) ${isLeaving ? "opacity-0" : ""}`
  const wordFade = leave?.transforms ? "" : fade
  const wordProps = (i: number) => ({
    children: WORDS[i],
    ref: (el: HTMLDivElement | null) => void (wordRefs.current[i] = el),
    transform: leave?.transforms?.[i],
  })
  return (
    <div
      ref={ref}
      className={`fixed inset-0 z-50 overflow-hidden select-none uppercase screenshot:hidden ${
        isLeaving ? "pointer-events-none" : ""
      }`}
      style={
        {
          "--leave-duration": `${LEAVE_DURATION}ms`,
          "--horizon": `${HORIZON * 100}%`,
        } as CSSProperties
      }
    >
      <div className={`absolute inset-0 bg-background ${fade}`}>
        <Sky />
        {isHydrated && <CoverScene horizon={HORIZON} isLeaving={isLeaving} />}
        <Scanlines />
      </div>
      <div className="relative h-full flex flex-col">
        <div className={`p-main flex justify-between gap-4 ${fade}`}>
          <span>
            {metadata.title as string} v{process.env.APP_VERSION}
          </span>
          <Backend />
        </div>
        <div className="absolute inset-x-0 top-0 h-3/5 flex flex-col items-center justify-center gap-[3vh] px-(--padding-main)">
          <div
            className="relative text-[min(calc((100vw-2*var(--padding-main))/47.5),2.2vh,20px)]/[1.08]"
            style={{ width: `${LOGO_COLS}ch` }}
          >
            <Word {...wordProps(0)} className={`mb-[-1.08em] ${wordFade}`} />
            <div className="flex mb-[-2.16em]">
              <Word {...wordProps(1)} className={wordFade} />
              <Word
                {...wordProps(2)}
                className={wordFade}
                style={{ marginLeft: `${WORD_GAP}ch` }}
              />
            </div>
          </div>
          <p className={`max-w-[42ch] text-center normal-case ${fade}`}>{metadata.description}</p>
        </div>
        <div
          className={`absolute inset-x-0 top-3/5 bottom-0 flex items-center justify-center ${fade}`}
        >
          <StartButton onClick={start} disabled={!isHydrated} />
        </div>
        <div className={`mt-auto p-main flex justify-between items-end gap-4 ${fade}`}>
          <LoadStatus />
          <span className="text-right">
            © 2026 <ExtLink href="https://danielmarcus.de/">Daniel Marcus</ExtLink>
          </span>
        </div>
      </div>
    </div>
  )
}

const getFontSize = (el: Element) => parseFloat(getComputedStyle(el).fontSize)

interface WordProps {
  children: string
  ref: React.Ref<HTMLDivElement>
  transform?: string // when leaving
  className?: string
  style?: CSSProperties
}

// same text as in the header logo (to match it when leaving) + the blur of the font
function Word({ children, ref, transform, className = "", style }: WordProps) {
  const text = useMemo(() => getAsciiText(children), [children])
  const blur = useMemo(() => getAsciiBlur(children), [children])
  const isFlying = !!transform
  return (
    <div
      ref={ref}
      className={`relative origin-top-left [transition-property:transform,opacity] duration-(--leave-duration) ease-[cubic-bezier(0.7,0,0.2,1)] ${className}`}
      style={{ ...style, transform }}
    >
      <pre
        className={`absolute top-0 left-[-2ch] transition-opacity duration-300 ${
          isFlying ? "opacity-0" : "opacity-30"
        }`}
        aria-hidden
      >
        {blur}
      </pre>
      <pre className="relative">{text}</pre>
    </div>
  )
}

// horizon glow behind the scene
const Sky = () => (
  <>
    <div className="absolute inset-x-0 top-0 h-(--horizon) bg-linear-to-t from-[rgb(100,20,255)]/30 to-transparent to-40%" />
    <div className="absolute inset-x-0 top-(--horizon) h-[12%] bg-linear-to-b from-[rgb(100,20,255)]/30 to-transparent" />
  </>
)

const Scanlines = () => (
  <div className="absolute inset-0 pointer-events-none bg-[repeating-linear-gradient(to_bottom,transparent_0_2px,rgb(0_0_0/0.25)_2px_3px)]" />
)

function Backend() {
  const backendReady = useGlobalStore((s) => s.backendReady)
  return <span className="text-right">{backendReady ? tf.getBackend() : ""}</span>
}

interface StartButtonProps {
  onClick: () => void
  disabled: boolean
}

// as the prompt on an arcade title screen
const StartButton = ({ onClick, disabled }: StartButtonProps) => (
  <button
    className="px-4 py-2 border border-foreground rounded-btn bg-background/80 uppercase tracking-[0.4em] indent-[0.4em] text-white hover:border-accent hover:bg-accent active:border-accent active:bg-accent disabled:border-muted disabled:text-muted"
    onClick={onClick}
    disabled={disabled}
  >
    {disabled ? "Loading" : "Press Start"}
  </button>
)

const BAR_LENGTH = 12

function LoadStatus() {
  const { total, loaded, isReady } = useLoadProgress()
  const checked = total ? Math.round((loaded / total) * BAR_LENGTH) : 0
  return (
    <span className="whitespace-nowrap">
      {"> "}
      {isReady ? (
        "Ready."
      ) : (
        <>
          Loading models <span className="text-marker">{"█".repeat(checked)}</span>
          {"░".repeat(BAR_LENGTH - checked)} {total ? `${loaded}/${total}` : ""}
        </>
      )}
      <span className="animate-blink motion-reduce:animate-none"> █</span>
    </span>
  )
}
