import { useStatusText } from "@/components/status"
import {
  HiddenLayerConfig,
  HiddenLayerConfigArray,
  LayerConfigMap,
  useModelStore,
} from "@/tf/model"
import {
  ControlPanel,
  InlineButton,
  InputRow,
  Select,
  Slider,
} from "@/ui-components"
import { DraggableList } from "@/ui-components/draggable-list"
import { ReactNode, useRef } from "react"

function getInputComp<T extends keyof LayerConfigMap>(
  layerConfig: HiddenLayerConfig<T>,
  updateLayerConfig: <C extends keyof LayerConfigMap>(
    config: HiddenLayerConfig<C>["config"]
  ) => void
): ReactNode {
  const sharedSliderProps = { showValue: true, lazyUpdate: true }
  if (layerConfig.className === "Dense") {
    const config = layerConfig.config as LayerConfigMap["Dense"]
    return (
      <Slider
        {...sharedSliderProps}
        min={1}
        max={256}
        value={config.units}
        onChange={(units) => updateLayerConfig({ ...config, units })}
      />
    )
  } else if (layerConfig.className === "Conv2D") {
    const config = layerConfig.config as LayerConfigMap["Conv2D"]
    return (
      <Slider
        {...sharedSliderProps}
        min={1}
        max={32}
        value={config.filters}
        onChange={(filters) => updateLayerConfig({ ...config, filters })}
      />
    )
  } else if (layerConfig.className === "MaxPooling2D") {
    return null
  } else if (layerConfig.className === "Flatten") {
    return null
  } else if (layerConfig.className === "Dropout") {
    const config = layerConfig.config as LayerConfigMap["Dropout"]
    return (
      <Slider
        {...sharedSliderProps}
        min={0}
        max={0.95}
        step={0.05}
        value={config.rate}
        onChange={(rate) => updateLayerConfig({ ...config, rate })}
      />
    )
  } else {
    console.log("Unknown layer type", layerConfig)
  }
  return null
}

const defaultConfigMap: { [K in keyof LayerConfigMap]: LayerConfigMap[K] } = {
  Dense: { units: 64, activation: "relu" },
  Conv2D: { filters: 4, kernelSize: 3, activation: "relu" },
  MaxPooling2D: { poolSize: 2 },
  Flatten: {},
  Dropout: { rate: 0.2 },
}

function newDefaultLayer<T extends keyof LayerConfigMap>(
  className: T
): HiddenLayerConfig<T> {
  const layer = { className, config: { ...defaultConfigMap[className] } }
  return layer as HiddenLayerConfig<T>
}

export const LayerConfigControl = () => {
  const model = useModelStore((s) => s.model)
  const layerConfigs = (model?.getConfig().layers ??
    []) as unknown as HiddenLayerConfigArray
  const _hiddenLayers = layerConfigs.slice(1, -1)
  const hiddenLayers = _hiddenLayers.filter((l) => l.className !== "Flatten")
  const setHiddenLayers = useModelStore((s) => s.setHiddenLayers)

  const selectRef = useRef<HTMLSelectElement>(null)
  const handleAdd = () => {
    if (!selectRef.current) return
    const className = selectRef.current.value
    const newLayer = newDefaultLayer(className as keyof LayerConfigMap)
    // always insert Conv2D and MaxPooling2D before Dense (which comes with Flatten)
    const firstDenseIdx = hiddenLayers.findIndex((l) => l.className === "Dense")
    const newHiddenLayers =
      ["MaxPooling2D", "Conv2D"].includes(className) && firstDenseIdx > -1
        ? hiddenLayers.toSpliced(firstDenseIdx, 0, newLayer)
        : [...hiddenLayers, newLayer]
    setHiddenLayers(newHiddenLayers)
  }
  const handleRemove = (i: number) => {
    setHiddenLayers(hiddenLayers.filter((_, j) => j !== i))
  }
  const hasMutliDimInput =
    model?.layers[0].batchInputShape &&
    model?.layers[0].batchInputShape.length > 2
  const selectOptions = [
    {
      value: "",
      label: "add",
      disabled: true,
    },
    { value: "Dense" },
    { value: "Conv2D", disabled: !hasMutliDimInput },
    { value: "MaxPooling2D", disabled: !hasMutliDimInput },
    { value: "Dropout" },
  ]
  return (
    <ControlPanel title={"hidden layers"}>
      <div className="flex flex-col gap-4">
        <DraggableList
          rowHeight={32}
          onOrderChange={(newOrder) => {
            const newHiddenLayers = newOrder.map((i) => hiddenLayers[i])
            setHiddenLayers([...newHiddenLayers])
          }}
          checkValidChange={(newOrder) =>
            checkVaildOrder(newOrder, hiddenLayers)
          }
        >
          {hiddenLayers.map((layer, i) => {
            function updateLayerConfig<T extends keyof LayerConfigMap>(
              newConfig: HiddenLayerConfig<T>["config"]
            ) {
              hiddenLayers[i].config = newConfig
              setHiddenLayers([...hiddenLayers])
            }
            const inputComp = getInputComp(layer, updateLayerConfig)
            const label = (
              <div className="flex justify-between">
                <div>
                  ⋮{" "}
                  {layer.className
                    .replace("MaxPooling2D", "MaxPool")
                    .replace("Flatten", "[Flatten]")}
                </div>
                <button onClick={() => handleRemove(i)} className="px-2">
                  x
                </button>
              </div>
            )
            return (
              <InputRow key={`${i}_${layer.className}`} label={label}>
                {inputComp}
              </InputRow>
            )
          })}
        </DraggableList>
        <InputRow
          label={
            <Select
              ref={selectRef}
              options={selectOptions}
              onChange={handleAdd}
              value={""}
            />
          }
        >
          <div className="flex justify-end items-center gap-4">
            <InlineButton
              variant="secondary"
              onClick={() => setHiddenLayers([])}
            >
              reset
            </InlineButton>
          </div>
        </InputRow>
      </div>
    </ControlPanel>
  )
}

function checkVaildOrder(
  newOrder: number[],
  hiddenLayers: HiddenLayerConfigArray
) {
  const newHiddenLayers = newOrder.map((i) => hiddenLayers[i])
  const firstDenseIdx = newHiddenLayers.findIndex(
    (l) => l.className === "Dense"
  )
  const lastMultiDimIdx = newHiddenLayers.findLastIndex((l) =>
    ["Conv2D", "MaxPooling2D"].includes(l.className)
  )
  const isValdid = firstDenseIdx < 0 || lastMultiDimIdx < firstDenseIdx
  if (!isValdid) {
    useStatusText
      .getState()
      .setStatusText("Conv2D and MaxPooling2D must come before Dense")
  }
  return isValdid
}
