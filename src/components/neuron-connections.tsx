import { Line } from "@react-three/drei"
import { Point } from "./sequential"
import { normalize } from "@/lib/datasets"

export const LINE_ACTIVATION_THRESHOLD = 0.5
// maybe use dynamic threshold based on max weight?
const LINE_Z_THRESHOLD = 0.5

type NeuronConnectionsProps = {
  linePoints?: [Point, Point][]
  weights?: number[]
  inputs?: number[]
}

const MAX_WIDTH = 0.5

export const NeuronConnections = ({
  linePoints,
  weights,
  inputs,
}: NeuronConnectionsProps) => {
  const zValues = weights?.map((w, i) => Math.abs(w * (inputs?.[i] ?? 0)))
  const zNorm = normalize(zValues)
  return (
    <group>
      {linePoints?.map((points, j) => {
        const z = zNorm?.[j] ?? 0
        if (z < LINE_Z_THRESHOLD) return null
        const lineWidth = Math.min(z * MAX_WIDTH, MAX_WIDTH)
        return <Line key={j} points={points} lineWidth={lineWidth} />
      })}
    </group>
  )
}
