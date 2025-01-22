import { useControls } from "leva"

export function useSplitColors() {
  // TODO: render only if data has color channels
  // nice2have: sliding animation ...
  const { splitColors } = useControls("ui", {
    splitColors: false,
  })
  return splitColors
}
