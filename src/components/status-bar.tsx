import React, { useRef, useEffect, ReactNode, useMemo, createRef } from "react"
import { clearStatus, useGlobalStore } from "@/store"
import { ProgressBar } from "./progress-bar"
import { Table } from "./ui-elements"

export const neuronStatusPortal = createRef<HTMLDivElement>()
export const sampleViewerPortal = createRef<HTMLDivElement>()

export const StatusBar = () => {
  return (
    <div className="fixed z-20 bottom-0 left-0 w-[100vw] select-none pointer-events-none screenshot:hidden">
      <div className={`-mb-1 relative`}>
        <div className="flex justify-between items-end relative">
          <div ref={neuronStatusPortal} />
          <Status />
        </div>
      </div>
      <div ref={sampleViewerPortal} />
      <ProgressBar />
    </div>
  )
}

const Status = () => {
  const status = useGlobalStore((s) => s.status.getCurrent())
  const parsedText = useMemo(
    () =>
      isValidReactNode(status?.text) || !status ? (
        (status?.text as ReactNode)
      ) : (
        <Table {...status.text} />
      ),
    [status]
  )
  const keptText = useRef<ReactNode>("")
  useEffect(() => {
    if (parsedText !== null && !status?.fullscreen) {
      keptText.current = parsedText
    }
  }, [parsedText, status])
  const onClick = status ? () => clearStatus(status.id) : undefined
  return (
    <div
      className={`p-main active:brightness-120 rounded-box pointer-events-none ${
        status?.fullscreen
          ? "fixed top-0 left-0 w-screen h-screen flex items-center justify-center"
          : "absolute right-0 bottom-0 sm:relative lg:max-w-[33vw] ml-auto"
      }  ${
        !!status?.text ? "opacity-100 duration-0" : "opacity-0 duration-300"
      } transition ease-in-out text-right`}
    >
      <div
        className={status?.text ? "pointer-events-auto " : ""}
        onClick={onClick}
      >
        {parsedText || keptText.current}
      </div>
    </div>
  )
}

function isValidReactNode(node: unknown): node is ReactNode {
  return (
    node === null ||
    node === undefined ||
    React.isValidElement(node) ||
    typeof node === "string" ||
    typeof node === "number" ||
    Array.isArray(node)
  )
}
