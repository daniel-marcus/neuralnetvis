import { Line } from "@react-three/drei"
import * as THREE from "three"

interface ConnectionProps {
  start: THREE.Vector3
  end: THREE.Vector3
  input?: number
  weight?: number
  bias?: number
}

export const Connection = ({
  start,
  end,
  weight = 0,
  input = 0,
  bias = 0,
}: ConnectionProps) => {
  const z = weight * input + bias
  return <Line points={[start, end]} lineWidth={z} />
}
