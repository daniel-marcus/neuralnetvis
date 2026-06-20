import type * as THREE from "three/webgpu"
import tunnel from "tunnel-rat"
import type { RootState as RootStateGL } from "@react-three/fiber"

export const Tunnel = tunnel()

export type RootState = Omit<RootStateGL, "gl"> & {
  gl: THREE.WebGPURenderer & {
    setCanvasTarget: (target: THREE.CanvasTarget) => void
  }
}
