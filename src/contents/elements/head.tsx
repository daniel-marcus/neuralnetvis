import { useAsciiText } from "@/utils/ascii-text"
import { useScrollCallbacks } from "./block"
import type { ReactNode } from "react"
import type { ScrollBlockProps } from "./types"

type HeadProps = { title: string; description?: string } & ScrollBlockProps

export function Head(props: HeadProps) {
  const { title, description, ...callbacks } = props
  const [ref] = useScrollCallbacks(callbacks)
  return (
    <div ref={ref}>
      <Title>{title}</Title>
      {!!description && <Teaser>{description}</Teaser>}
    </div>
  )
}

interface TitleProps {
  children: string
  className?: string
  dynamic?: boolean
}

export function Title({
  children,
  className = "",
  dynamic = true,
}: TitleProps) {
  const title = useAsciiText(children)
  return (
    <div className={`${className}`}>
      <h1 className="hidden">{children}</h1>
      <pre
        className={dynamic ? "text-[min(1.25vw,0.75rem)]/[1.2]" : "text-logo"}
      >
        {title}
      </pre>
    </div>
  )
}

function Teaser({ children }: { children: ReactNode }) {
  return <div className="pt-12 pb-[50dvh]">{children}</div>
}
