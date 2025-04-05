import { AsciiText } from "@/components/ui-elements/ascii-text"
import { useScrollCallbacks } from "./block"
import type { ReactNode } from "react"
import type { ScrollBlockProps } from "./types"

interface HeadProps extends ScrollBlockProps {
  title: string
  description?: string
}

export function Head(props: HeadProps) {
  const { title, description, ...callbacks } = props
  const [ref] = useScrollCallbacks(callbacks)
  // title is only placeholder here. visible title is SceneTitle
  return (
    <div ref={ref}>
      <Title className={"opacity-0"}>{title}</Title>
      {!!description && <Teaser>{description}</Teaser>}
    </div>
  )
}

interface TitleProps {
  children: string
  className?: string
}

export function Title({ children, className = "" }: TitleProps) {
  return (
    <div className={`${className}`}>
      <h1 className="hidden">{children}</h1>
      <AsciiText className="text-ascii-title">{children}</AsciiText>
    </div>
  )
}

function Teaser({ children }: { children: ReactNode }) {
  return <div className="pt-12 pb-[50dvh] screenshot:opacity-0">{children}</div>
}
