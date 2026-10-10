"use client"

import { createContext, useContext, useRef } from "react"

type DomRefs = {
  rootRef: React.RefObject<HTMLDivElement | null>
  lessonOverlayRef: React.RefObject<HTMLDivElement | null>
  neuronInspectorRef: React.RefObject<HTMLDivElement | null>
  sampleViewerRef: React.RefObject<HTMLDivElement | null>
}

const DomRefsContext = createContext<DomRefs | null>(null)

export function DomRefsProvider({ children }: { children: React.ReactNode }) {
  const refs = {
    rootRef: useRef<HTMLDivElement>(null),
    lessonOverlayRef: useRef<HTMLDivElement>(null),
    neuronInspectorRef: useRef<HTMLDivElement>(null),
    sampleViewerRef: useRef<HTMLDivElement>(null),
  }
  return <DomRefsContext.Provider value={refs}>{children}</DomRefsContext.Provider>
}

export function useDomRefs() {
  const refs = useContext(DomRefsContext)
  if (!refs) throw new Error("useDomRefs must be used within <DomRefsProvider>")
  return refs
}
