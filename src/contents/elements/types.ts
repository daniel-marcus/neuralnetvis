import { useController } from "@/utils/controller"

type ControllerProps = ReturnType<typeof useController>

export interface OnBlockScrollProps extends ControllerProps {
  percent: number
}

export type OnBlockEnterLeaveProps = ControllerProps

export type ScrollBlockProps = React.PropsWithChildren<ScrollCallbacks> & {
  className?: string
}

export interface ScrollCallbacks {
  onScroll?: (props: OnBlockScrollProps) => void
  onEnter?: (props: OnBlockEnterLeaveProps) => void
  onLeave?: (props: OnBlockEnterLeaveProps) => void
}
