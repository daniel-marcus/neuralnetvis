import { useEffect, useMemo } from "react"
import { useSceneStore } from "@/store"
import { WheelMenu } from "@/components/ui-elements/wheel-menu"
import type { Layer } from "@tensorflow/tfjs-layers/dist/exports_layers"
import { Button } from "@/components/ui-elements"

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
      <ToggleFlatViewBtn />
    </div>
  )
}

function ToggleFlatViewBtn() {
  const isFlatView = useSceneStore((s) => s.vis.flatView)
  const setVisConfig = useSceneStore((s) => s.vis.setConfig)
  const toggleFlatView = () => setVisConfig({ flatView: !isFlatView })
  const focussedLayerIdx = useSceneStore((s) => s.focussedLayerIdx)
  const hasFocussed = typeof focussedLayerIdx === "number"
  useEffect(() => {
    if (!hasFocussed) setVisConfig({ flatView: false })
  }, [hasFocussed, setVisConfig])
  if (!hasFocussed) return null
  return (
    <div className="fixed top-[var(--header-height)] right-[var(--padding-main)]">
      <Button
        onClick={toggleFlatView}
        variant="primary"
        className="pointer-events-auto "
      >
        {isFlatView ? "3D" : "2D"} view
      </Button>
    </div>
  )
}

function isNotVisible(layer: Layer) {
  return ["Flatten", "Dropout"].includes(layer.getClassName())
}
