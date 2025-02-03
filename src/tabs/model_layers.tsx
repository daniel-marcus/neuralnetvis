import {
  HiddenLayerConfig,
  HiddenLayerConfigArray,
  LayerConfigMap,
  useModelStore,
} from "@/lib/model"
import { ControlPanel, InlineButton, InputRow, Slider } from "@/ui-components"
import { useRef } from "react"

function getSliderProps<T extends keyof LayerConfigMap>(
  layerConfig: HiddenLayerConfig<T>
) {
  if (layerConfig.className === "Dense") {
    const config = layerConfig.config as LayerConfigMap["Dense"]
    return {
      min: 1,
      max: 256,
      value: config.units,
      // label: "Units",
    }
  } else if (layerConfig.className === "Conv2D") {
    const config = layerConfig.config as LayerConfigMap["Conv2D"]
    return {
      min: 1,
      max: 32,
      value: config.filters,
      // label: "Filters",
    }
  } else if (layerConfig.className === "MaxPooling2D") {
    return null
  } else if (layerConfig.className === "Flatten") {
    return null
  }
  return null
}

const defaultConfigMap: { [K in keyof LayerConfigMap]: LayerConfigMap[K] } = {
  Dense: { units: 64, activation: "relu" },
  Conv2D: { filters: 4, kernelSize: 3, activation: "relu" },
  MaxPooling2D: { poolSize: 2 },
  Flatten: {},
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

  const handleLayerChange = (i: number, val: number) => {
    const layer = hiddenLayers[i]
    if (layer.className === "Dense") {
      ;(layer.config as LayerConfigMap["Dense"]).units = val
    } else if (layer.className === "Conv2D") {
      ;(layer.config as LayerConfigMap["Conv2D"]).filters = val
    }
    setHiddenLayers([...hiddenLayers])
  }
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
  return (
    <ControlPanel title={"hidden layers"}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {hiddenLayers.map((layer, i) => {
            const sliderProps = getSliderProps(layer)
            const label = (
              <div className="flex justify-between">
                <div>
                  {layer.className
                    .replace("MaxPooling", "MaxPool")
                    .replace("Flatten", "(Flatten)")}
                </div>
                <button onClick={() => handleRemove(i)}>x</button>
              </div>
            )
            return (
              <InputRow key={i} label={label}>
                {sliderProps !== null && (
                  <Slider
                    {...sliderProps}
                    onChange={(val) => handleLayerChange(i, val)}
                    showValue={true}
                    lazyUpdate={true}
                  />
                )}
              </InputRow>
            )
          })}
        </div>
        <InputRow label=" ">
          <div className="flex justify-start items-center gap-4">
            <InlineButton variant="secondary" onClick={handleAdd}>
              add
            </InlineButton>{" "}
            <div className="relative flex-1">
              <select
                ref={selectRef}
                className="w-full appearance-none bg-transparent"
              >
                <option>Dense</option>
                <option>Conv2D</option>
                <option>MaxPooling2D</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2">
                <svg
                  className="fill-current h-3 w-3"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>
          </div>
        </InputRow>
      </div>
    </ControlPanel>
  )
}
