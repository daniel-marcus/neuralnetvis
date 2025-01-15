import { Line } from "@react-three/drei"

interface ConnectionProps {
  start: [number, number, number]
  end: [number, number, number]
  input?: number
  weight?: number
}

export const Connection = ({
  start,
  end,
  weight = 0,
  input = 0,
}: ConnectionProps) => {
  const z = weight * input
  return <Line points={[start, end]} lineWidth={z} />
}
