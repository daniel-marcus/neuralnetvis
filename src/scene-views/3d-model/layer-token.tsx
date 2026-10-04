import { memo, useEffect, useLayoutEffect, useMemo } from "react"
import * as THREE from "three/webgpu"
import { useSceneStore } from "@/store"
import { getSeqPosition } from "@/data/next-token"
import {
  getTokenTexts,
  layoutTokens,
  TOKEN_CHAR_W,
  TOKEN_TILE_H,
} from "@/neuron-layers/token-layout"
import { useNeuronInteractions } from "./interactions"
import { useColors, useNeuronSpacing } from "./layer-instanced"
import { LABEL_COLOR } from "./label"
import type { TokenParagraph } from "@/neuron-layers/token-layout"
import type { NeuronLayer } from "@/neuron-layers/types"

// Text input layers: tokens as a paragraph of tiles (instanced mesh, colored by activation) with the
// decoded text on top. Instance matrices hold the tile positions & sizes, so that connections and
// highlights find the neurons as usual (see getWorldPos)

type TokenLayerProps = NeuronLayer & {
  measureRef: React.RefObject<THREE.Mesh | null>
}

const TILE_DEPTH = 0.3
const PX_PER_UNIT = 96 // text texture resolution
const FONT_FACE = "Menlo-Regular"

export const TokenLayer = memo(function TokenLayer(props: TokenLayerProps) {
  const { meshParams, meshRefs, measureRef, numNeurons } = props
  const [meshRef] = meshRefs
  const paragraph = useTokenParagraph(numNeurons)
  const [material, userData] = useColors(props, 0)
  const eventHandlers = useNeuronInteractions(props.index)
  const { size } = useNeuronSpacing(meshParams)
  const tempObj = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    for (let i = 0; i < numNeurons; i++) {
      const tile = paragraph?.tiles[i]
      const width = tile && !tile.isPadding ? tile.width : 0
      tempObj.position.set(0, tile?.y ?? 0, tile?.x ?? 0) // reading direction: z
      if (width) tempObj.scale.set(TILE_DEPTH / size, TOKEN_TILE_H / size, width / size)
      else tempObj.scale.setScalar(0) // padding: hidden
      tempObj.updateMatrix()
      mesh.setMatrixAt(i, tempObj.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingBox() // for raycasting & culling with the new layout
    mesh.computeBoundingSphere()
  }, [meshRef, tempObj, paragraph, numNeurons, size])

  return (
    <group ref={measureRef}>
      <instancedMesh
        ref={meshRef}
        name={`${props.lid}_tokens`}
        args={[meshParams.geometry, material, numNeurons]}
        userData={userData}
        {...eventHandlers}
      />
      {paragraph && <TokenText paragraph={paragraph} />}
    </group>
  )
})

function useTokenParagraph(numNeurons: number) {
  const rawX = useSceneStore((s) => s.sample?.rawX)
  const tokenizer = useSceneStore((s) => s.ds?.tokenizer)
  return useMemo(() => {
    if (!rawX || !tokenizer) return
    const tokens = Array.from(rawX).slice(0, numNeurons)
    const numVisible = getSeqPosition(tokens, tokenizer) + 1 // without padding at the end
    return layoutTokens(getTokenTexts(tokens, tokenizer), numVisible)
  }, [rawX, tokenizer, numNeurons])
}

const noRaycast = () => null

function TokenText({ paragraph }: { paragraph: TokenParagraph }) {
  const texture = useMemo(() => paragraphTexture(paragraph), [paragraph])
  useEffect(() => () => texture.dispose(), [texture])
  const lightsOn = useSceneStore((s) => s.vis.lightsOn)
  if (!lightsOn) return null
  return (
    <mesh
      position={[-TILE_DEPTH / 2 - 0.01, 0, 0]}
      rotation={[0, -Math.PI / 2, 0]} // facing -x, as the labels
      raycast={noRaycast}
    >
      <planeGeometry args={[paragraph.width, paragraph.height]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} color={LABEL_COLOR} />
    </mesh>
  )
}

function paragraphTexture({ tiles, width, height }: TokenParagraph) {
  const canvas = document.createElement("canvas")
  canvas.width = Math.ceil(width * PX_PER_UNIT)
  canvas.height = Math.ceil(height * PX_PER_UNIT)
  const ctx = canvas.getContext("2d")!
  // font size that matches the char width of the layout
  ctx.font = `100px ${FONT_FACE}`
  const advance = ctx.measureText("M").width / 100
  const fontSize = (TOKEN_CHAR_W * PX_PER_UNIT) / advance
  ctx.font = `${fontSize}px ${FONT_FACE}`
  ctx.fillStyle = "#ffffff" // actual color is set on the material
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  for (const tile of tiles) {
    if (tile.isPadding) continue
    const x = (tile.x + width / 2) * PX_PER_UNIT
    const y = (height / 2 - tile.y) * PX_PER_UNIT
    ctx.fillText(tile.text, x, y)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  return texture
}
