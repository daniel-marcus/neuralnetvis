import * as THREE from "three/webgpu"

declare module "three/webgpu" {
  class CanvasTarget {
    constructor(canvas: HTMLCanvasElement, opts?: { antialias: boolean })
    domElement: HTMLCanvasElement
    setPixelRatio(ratio: number)
    setSize(w: number, h: number, updateStyles?: boolean)
  }
}
