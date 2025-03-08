import { useGlobalStore } from "@/store"
import React, { useRef, useEffect, ReactNode, useMemo } from "react"
import { Table } from "./ui-elements"

export const Status = () => {
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
    if (parsedText !== null) {
      keptText.current = parsedText
    }
  }, [parsedText])
  return (
    <div
      className={`${
        status?.fullscreen
          ? "fixed top-0 left-0 w-screen h-screen flex items-center justify-center backdrop-blur-sm backdrop-brightness-75 backdrop-grayscale-100"
          : "absolute right-0 bottom-0 sm:relative lg:max-w-[33vw] ml-auto"
      }  ${
        !!status?.text
          ? "opacity-100 duration-0 pointer-events-auto"
          : "opacity-0 duration-300 pointer-events-none"
      } transition ease-in-out text-right`}
    >
      <div className={status?.fullscreen ? "p-4" : ""}>
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
