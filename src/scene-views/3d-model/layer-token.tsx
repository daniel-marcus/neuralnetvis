import { memo, Suspense, useEffect, useLayoutEffect, useMemo } from "react"
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
import { mergeAndDispose, textGeometry, useFont } from "./vector-text"
import type { Font } from "three/addons/loaders/FontLoader.js"
import type { TokenParagraph } from "@/neuron-layers/token-layout"
import type { NeuronLayer } from "@/neuron-layers/types"

// Text input layers: tokens as a paragraph of tiles (instanced mesh, colored by activation) with the
// decoded text on top. Instance matrices hold the tile positions & sizes, so that connections and
// highlights find the neurons as usual (see getWorldPos)

type TokenLayerProps = NeuronLayer & {
  measureRef: React.RefObject<THREE.Mesh | null>
}

const TILE_DEPTH = 0.3

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
      {paragraph && (
        <Suspense fallback={null}>
          <TokenText paragraph={paragraph} />
        </Suspense>
      )}
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
  const font = useFont()
  const geometry = useMemo(() => paragraphGeometry(font, paragraph), [font, paragraph])
  useEffect(() => () => geometry.dispose(), [geometry])
  const lightsOn = useSceneStore((s) => s.vis.lightsOn)
  if (!lightsOn) return null
  return (
    <mesh
      position={[-TILE_DEPTH / 2 - 0.01, 0, 0]}
      rotation={[0, -Math.PI / 2, 0]} // facing -x, as the labels
      geometry={geometry}
      raycast={noRaycast}
    >
      <meshBasicMaterial color={LABEL_COLOR} />
    </mesh>
  )
}

// vector glyphs for all tiles, merged into one geometry
function paragraphGeometry(font: Font, { tiles }: TokenParagraph) {
  // font size that matches the char width of the layout
  const fontSize = (TOKEN_CHAR_W * font.data.resolution) / font.data.glyphs["M"].ha
  const geometries: THREE.BufferGeometry[] = []
  for (const tile of tiles) {
    if (tile.isPadding) continue
    const geometry = textGeometry(font, tile.text, { fontSize, align: "center" })
    geometry.translate(tile.x, tile.y, 0)
    geometries.push(geometry)
  }
  return mergeAndDispose(geometries)
}
