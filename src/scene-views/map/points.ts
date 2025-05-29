import { useEffect, useState } from "react"
import * as tf from "@tensorflow/tfjs"
import { useGlobalStore, useSceneStore } from "@/store"
import { getDbDataAsTensors } from "@/data/dataset"
import { scaleNormalize } from "@/data/utils"
import { lngLatToScreen } from "./utils"
import type { Point } from "./types"

export function usePoints() {
  const backendReady = useGlobalStore((s) => s.backendReady)
  const [points, setPoints] = useState<Point[] | null>(null)
  const [minY, setMinY] = useState<number>(0)
  const ds = useSceneStore((s) => s.ds)
  const subset = useSceneStore((s) => s.subset)
  const batchCount = useSceneStore((s) => s.batchCount)
  useEffect(() => {
    setPoints(null)
    setMinY(0)
  }, [subset])
  useEffect(() => {
    if (!backendReady) return
    async function getPoints() {
      if (!ds) return
      const data = await getDbDataAsTensors(ds, subset, { returnRawX: true })
      if (!data) return
      const { y, XRaw } = data
      // assume that lon and lat are the first two features. TODO: prop names/idxs in dsDef
      const coordsTensor = XRaw?.slice([0, 0], [-1, 2])
      const yScaledTensor = scaleNormalize(y)
      const yNormTensor = tf.tidy(() => y.div(y.max()))
      const minYTensor = yNormTensor.min()

      try {
        if (!coordsTensor) return
        const coords = (await coordsTensor.array()) as number[][]
        const yScaled = (await yScaledTensor.array()) as number[]
        const yNorm = (await yNormTensor.array()) as number[]
        const minY = (await minYTensor.data())[0]

        const projectCoords = (coords: [number, number]) =>
          ds.mapProps
            ? lngLatToScreen(coords, ds.mapProps.center, ds.mapProps.zoom)
            : coords

        const points = Array.from({ length: yScaled.length }).map((_, i) => {
          const c = (coords?.[i] as [number, number]) ?? [0, 0]
          const [lon, lat] = projectCoords(c)
          return {
            lon,
            lat,
            y: yScaled[i],
            yNorm: yNorm[i],
          }
        })
        setMinY(minY)
        setPoints(points)
      } catch (e) {
        console.warn(e)
      } finally {
        Object.values(data).forEach((t) => t?.dispose())
        coordsTensor?.dispose()
        yScaledTensor.dispose()
        yNormTensor.dispose()
        minYTensor.dispose()
      }
    }
    getPoints()
  }, [subset, batchCount, ds, backendReady])
  return [points, minY] as const
}
