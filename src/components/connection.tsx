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
  const z = Math.abs(weight * input)
  const lineWidth = Math.min(z * 1, 3)
  // TODO: scaled values?
  return <Line points={[start, end]} lineWidth={lineWidth} />
}
