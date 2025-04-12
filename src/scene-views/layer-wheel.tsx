import { useMemo } from "react"
import { useSceneStore } from "@/store"
import { WheelMenu } from "@/components/ui-elements/wheel-menu"
import type { Layer } from "@tensorflow/tfjs-layers/dist/exports_layers"

export const LayerWheel = () => {
  const model = useSceneStore((s) => s.model)
  const layers = useMemo(() => model?.layers ?? [], [model])
  const focussedIdx = useSceneStore((s) => s.focussedLayerIdx)
  const setFocussedIdx = useSceneStore((s) => s.setFocussedLayerIdx)

  const items = useMemo(
    () =>
      layers.map((l) => ({
        label: `${l.getClassName()}`,
        disabled: isNotVisible(l),
      })),
    [layers]
  )

  return (
    <div
      className={`fixed top-0 right-0 h-screen flex flex-col items-start justify-center pointer-events-none overflow-visible`}
    >
      <WheelMenu
        items={items}
        currIdx={focussedIdx}
        setCurrIdx={setFocussedIdx}
      />
    </div>
  )
}

function isNotVisible(layer: Layer) {
  return ["Flatten", "Dropout"].includes(layer.getClassName())
}
