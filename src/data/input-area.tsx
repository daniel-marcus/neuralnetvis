import type { ReactNode } from "react"
import { useSceneStore } from "@/store"
import { Button } from "@/components/ui-elements"

interface InputAreaProps {
  title?: ReactNode
  buttons?: ReactNode // right-aligned below the input
  children: ReactNode // the input box (w-full), e.g. canvas or textarea
}

// shared layout of DrawArea and TextArea: title bar with close button, input box, button bar
export const InputArea = ({ title, buttons, children }: InputAreaProps) => {
  const toggleInputAreaShown = useSceneStore((s) => s.toggleInputAreaShown)
  return (
    <div className="z-20 w-40 lg:w-75 flex flex-col gap-2 pointer-events-auto pt-8">
      <div className="flex justify-between items-center">
        <div>{title}</div>
        <Button onClick={toggleInputAreaShown} variant="transparent" className="-mr-2">
          ×
        </Button>
      </div>
      {children}
      {!!buttons && <div className="flex justify-end gap-2">{buttons}</div>}
    </div>
  )
}
