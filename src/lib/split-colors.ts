import { useControls } from "leva"
import { Dataset } from "./datasets"

export function useSplitColors(ds?: Dataset) {
  // nice2have: sliding animation ...
  const hasColorChannels = !!ds?.data.trainX.shape[3]
  const { hideLines, splitColors } = useControls(
    "ui",
    {
      hideLines: false,
      splitColors: {
        value: false,
        render: () => hasColorChannels,
      },
    },
    { collapsed: true },
    [hasColorChannels]
  )
  return [hideLines, splitColors] as const
}
