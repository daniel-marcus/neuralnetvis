import { Pos } from "@/scene-views/3d-model/utils"

export interface OnScrollProps {
  percent: number
}

export type ScrollBlockProps = React.PropsWithChildren<ScrollCallbacks> & {
  className?: string
  cameraPos?: Pos
  nextProps?: ScrollBlockProps
}

export interface ScrollCallbacks {
  onScroll?: (props: OnScrollProps) => void
  onEnter?: () => void
  onLeave?: () => void
}
