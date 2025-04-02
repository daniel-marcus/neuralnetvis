import React, { useRef, useEffect, ReactNode, useMemo } from "react"
import { clearStatus, useCurrScene, useGlobalStore } from "@/store"
import { NeuronStatus } from "./neuron-status"
import { ProgressBar } from "./progress-bar"
import { Table } from "./ui-elements"
import { SampleViewer } from "./sample-viewer"

export const StatusBar = () => {
  const hasSampleViewer = useCurrScene(
    (s) => s.view === "evaluation" && !!s.sampleViewerIdxs.length
  )
  console.log("hasSampleViewer", hasSampleViewer)
  return (
    <div className="fixed z-20 bottom-0 left-0 w-[100vw] select-none pointer-events-none">
      <div className={`-mb-1 relative`}>
        <div className="flex justify-between items-end relative">
          <NeuronStatus />
          <Status />
        </div>
      </div>
      <SampleViewer />
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
      className={`p-main rounded-box ${
        status?.fullscreen
          ? "fixed top-0 left-0 w-screen h-screen flex items-center justify-center pointer-events-none"
          : "absolute right-0 bottom-0 sm:relative lg:max-w-[33vw] ml-auto"
      }  ${
        !!status?.text
          ? "opacity-100 duration-0 pointer-events-auto"
          : "opacity-0 duration-300 pointer-events-none"
      } transition ease-in-out text-right`}
    >
      <div
        className={status?.fullscreen ? "pointer-events-auto" : ""}
        onClick={onClick}
      >
        {parsedText || keptText.current}
      </div>
    </div>
  )
}

export function useHasBlur() {
  const status = useGlobalStore((s) => s.status.getCurrent())
  const isEvaluationView = useCurrScene((s) => s.view === "evaluation")
  const hasSample = useCurrScene((s) => s.sampleIdx !== undefined)
  return !!status?.fullscreen || (isEvaluationView && !hasSample)
}

export function BlurMask() {
  const hasBlur = useHasBlur()
  return (
    <div
      className={`absolute top-0 left-0 w-full h-full ${
        hasBlur
          ? "backdrop-blur-sm backdrop-brightness-75 backdrop-grayscale-100"
          : "pointer-events-none"
      } transition-all duration-300`}
    />
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
