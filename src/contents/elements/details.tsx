import type { ReactNode } from "react"
import { CollapsibleWithTitle } from "@/components/ui-elements"

interface DetailsProps {
  title: string
  children: ReactNode
}

export function Details({ title, children }: DetailsProps) {
  return (
    <CollapsibleWithTitle
      title={title}
      variant="has-bg"
      collapsed
      className="inline-block mt-8 max-w-[32rem]"
    >
      {children}
    </CollapsibleWithTitle>
  )
}
