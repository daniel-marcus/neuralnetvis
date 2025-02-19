declare module "troika-three-text" {
  import * as THREE from "three"

  class Text {
    text?: string | number
    position?: [number, number, number]
    fontSize?: number
    font?: string
    color?: string | THREE.Color
    anchorX?: "left" | "center" | "right"
    anchorY?: "top" | "middle" | "bottom"
    rotation?: [number, number, number]
    sync: (cb: () => void) => void
  }
}
