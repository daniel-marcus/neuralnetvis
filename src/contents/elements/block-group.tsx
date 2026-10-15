import { useScrollCallbacks } from "./block"
import type { ScrollBlockProps } from "./types"

/**
 * Shares one scroll action (onScroll percent over the whole group, onEnter/onLeave, camera) across
 * several child <Block>s, which keep their own padding and get activated (opacity) individually.
 */
export function BlockGroup(props: ScrollBlockProps) {
  const { children, className, ...scrollProps } = props
  const [ref] = useScrollCallbacks(scrollProps)
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
