import { useStore } from "@/store"
import React, { useRef, useEffect, ReactNode, useMemo } from "react"
import { Table } from "./ui-elements"

export const Status = () => {
  const statusText = useStore((s) => s.status.getText())
  const parsedText = useMemo(
    () =>
      isValidReactNode(statusText) ? statusText : <Table {...statusText} />,
    [statusText]
  )
  const keptText = useRef<ReactNode>("")
  useEffect(() => {
    if (parsedText !== null) {
      keptText.current = parsedText
    }
  }, [parsedText])
  return (
    <div
      className={`absolute right-0 bottom-0 sm:relative lg:max-w-[33vw] ml-auto ${
        !!statusText
          ? "opacity-100 duration-0 pointer-events-auto"
          : "opacity-0 duration-300 pointer-events-none"
      } transition-opacity ease-in-out text-right`}
    >
      {parsedText || keptText.current}
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
