export interface OnScrollProps {
  percent: number
}

export type ScrollBlockProps = React.PropsWithChildren<ScrollCallbacks> & {
  className?: string
}

export interface ScrollCallbacks {
  onScroll?: (props: OnScrollProps) => void
  onEnter?: () => void
  onLeave?: () => void
}
