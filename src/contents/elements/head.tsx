import { useAsciiText } from "@/utils/ascii-text"
import { useScrollCallbacks } from "./block"
import type { ReactNode } from "react"
import type { ScrollCallbacks } from "./types"

type HeadProps = { title: string; description: string } & ScrollCallbacks

export function Head(props: HeadProps) {
  const { title, description, ...callbacks } = props
  const [ref] = useScrollCallbacks(callbacks)
  return (
    <div ref={ref}>
      <Title>{title}</Title>
      <Teaser>{description}</Teaser>
    </div>
  )
}

function Title({ children }: { children: string }) {
  const title = useAsciiText(children)
  return (
    <div className="mb-12">
      <h1 className="hidden">{children}</h1>
      <pre className="text-[min(1.25vw,0.75rem)]/[1.2]">{title}</pre>
    </div>
  )
}

function Teaser({ children }: { children: ReactNode }) {
  return <div className="pb-[50dvh]">{children}</div>
}
