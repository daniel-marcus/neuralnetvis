import { ReactElement, useContext, useRef } from "react"
import { Neuron, NeuronDef, NeuronState } from "./neuron"
import type { Dataset } from "@/lib/datasets"
import { getGridWidth, type LayerPosition, type LayerProps } from "./sequential"
import { Instances, PositionMesh } from "@react-three/drei"
import { AdditiveBlending, Vector3 } from "three"
import { OptionsContext } from "./model"
import { Connections } from "./connections"
import { useFrame } from "@react-three/fiber"

export interface DenseProps {
  index: number
  layerPosition: LayerPosition
  // positions?: [number, number, number][] // keep separated from changing data
  allLayers?: LayerProps[]
  ds?: Dataset
  neurons: (NeuronDef & NeuronState)[]
}

export const Dense = (props: DenseProps) => {
  const { index, allLayers, ds, layerPosition } = props
  const colorChannels = ds?.data.trainX.shape[3] ?? 1
  const hasColorChannels = colorChannels > 1
  const groups =
    hasColorChannels && layerPosition === "input" ? colorChannels : 1
  const prevLayer = allLayers?.[index - 1]
  return (
    <group name={`dense_${index}`}>
      {Array.from({ length: groups }).map((_, groupIndex) => {
        return (
          <NeuronGroup
            key={groupIndex}
            groupIndex={groupIndex}
            groups={groups}
            {...props}
          />
        )
      })}
      {!!prevLayer && <Connections layer={props} prevLayer={prevLayer} />}
    </group>
  )
}

type NeuronGrupProps = DenseProps & {
  groupIndex: number
  groups: number
}

const NeuronGroup = (props: NeuronGrupProps) => {
  const { groupIndex, groups, ...layerProps } = props
  const { allLayers, ds, neurons, layerPosition } = layerProps
  const geometry = getGeometry(layerPosition, neurons.length)
  const { splitColors } = useContext(OptionsContext)
  const hasAdditiveBlending =
    layerPosition === "input" && groups > 1 && !splitColors
  const groupedNeurons = neurons.filter((n) => n.index % groups === groupIndex)

  const ref = useRef<PositionMesh>(null!)
  const gridWidth = getGridWidth(groupedNeurons.length, layerPosition) + 0.6
  const rest = groupIndex % groups
  const shiftZ = 1 * (rest - (groups - 1) / 2)

  const position = splitColors ? [0, 0, shiftZ * gridWidth] : [0, 0, 0]
  const currentPosition = useRef(new Vector3())
  useFrame(() => {
    // TODO: shift group instead of individual neurons
    if (ref.current) {
      const targetPosition = new Vector3(...position)
      const speed = 0.4
      currentPosition.current.x = customInterpolation(
        currentPosition.current.x,
        targetPosition.x,
        speed
      )
      currentPosition.current.y = customInterpolation(
        currentPosition.current.y,
        targetPosition.y,
        speed
      )
      currentPosition.current.z = customInterpolation(
        currentPosition.current.z,
        targetPosition.z,
        speed
      )

      ref.current.position.copy(currentPosition.current)
    }
  })

  return (
    <group ref={ref}>
      <Instances
        limit={groupedNeurons.length}
        key={`${groupIndex}_${groupedNeurons.length}`} // _${hasAdditiveBlending}
      >
        {geometry}
        <meshStandardMaterial
          blending={hasAdditiveBlending ? AdditiveBlending : undefined}
        />
        {groupedNeurons.map((neuronProps, i) => {
          return (
            <Neuron
              key={i}
              layer={props}
              allLayers={allLayers}
              ds={ds}
              {...neuronProps}
            />
          )
        })}
      </Instances>
    </group>
  )
}

const geometryMap: Record<string, ReactElement> = {
  boxSmall: <boxGeometry args={[0.6, 0.6, 0.6]} />,
  boxBig: <boxGeometry args={[1.8, 1.8, 1.8]} />,
  sphere: <sphereGeometry args={[0.6, 32, 32]} />,
}

function getGeometry(type: LayerPosition, units: number) {
  if (["input", "output"].includes(type)) {
    if (units <= 10) return geometryMap.boxBig
    return geometryMap.boxSmall
  }
  return geometryMap.sphere
}

const customInterpolation = (start: number, end: number, alpha: number) => {
  return start + (end - start) * alpha
}
