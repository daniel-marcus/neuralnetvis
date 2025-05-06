declare module "troika-three-text" {
  import * as THREE from "three"

  class Text extends THREE.Object3D {
    text?: string | number
    fontSize?: number
    font?: string
    color?: string | THREE.Color
    anchorX?: "left" | "center" | "right"
    anchorY?: "top" | "middle" | "bottom"
    sync: (cb: () => void) => void
  }
}
