import { useEffect, useSyncExternalStore } from "react"

type Callback = () => void | Promise<void>

export function useKeyCommand(key: string, cb: Callback, isActive = true, preventDefault = false) {
  useEffect(() => {
    if (!isActive) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditable(document.activeElement)) return
      if (e.key === key) {
        if (preventDefault) e.preventDefault()
        cb()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [key, cb, isActive, preventDefault])
}

function isEditable(el: Element | null) {
  const tagName = el?.tagName.toLowerCase()
  return (
    tagName === "input" || tagName === "textarea" || (el as HTMLElement | null)?.isContentEditable
  )
}

// keys for own key handlers + Button keyHint: e.key with optional modifiers, e.g. "Enter", "mod+s"
// (mod: cmd on macOS, ctrl elsewhere)
export function matchesKeys(e: { key: string } & KeyModifiers, keys: string) {
  const { key, mod, alt, shift } = parseKeys(keys)
  const isMac = isMacPlatform()
  return (
    e.key === key &&
    (isMac ? e.metaKey : e.ctrlKey) === mod &&
    !(isMac ? e.ctrlKey : e.metaKey) &&
    e.altKey === alt &&
    // single characters: shift is already part of e.key (e.g. "L")
    (key.length === 1 ? !shift || e.shiftKey : e.shiftKey === shift)
  )
}

// label for the keys, e.g. "⌘S" on macOS, "Ctrl+S" elsewhere (undefined until hydrated)
export function useKeysLabel(keys?: string) {
  const isMac = useSyncExternalStore(subscribeNoop, isMacPlatform, () => undefined)
  return keys && isMac !== undefined ? formatKeys(keys, isMac) : undefined
}

interface KeyModifiers {
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
}

function parseKeys(keys: string) {
  const parts = keys.split(/\+(?!$)/) // keep "+" itself as key, e.g. "mod++"
  const key = parts.pop() ?? ""
  return {
    key,
    mod: parts.includes("mod"),
    alt: parts.includes("alt"),
    shift: parts.includes("shift"),
  }
}

function formatKeys(keys: string, isMac: boolean) {
  const { key, mod, alt, shift } = parseKeys(keys)
  const modifiers = isMac
    ? [mod && "⌘", alt && "⌥", shift && "⇧"]
    : [mod && "Ctrl", alt && "Alt", shift && "Shift"]
  const keyLabel = KEY_LABELS[key] ?? key.toUpperCase()
  return [...modifiers.filter(Boolean), keyLabel].join(isMac ? "" : "+")
}

const KEY_LABELS: Record<string, string> = {
  Enter: "↵",
  Escape: "Esc",
  " ": "Space",
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
}

const subscribeNoop = () => () => {}

function isMacPlatform() {
  return /Mac|iPhone|iPad/.test(navigator.userAgent)
}
