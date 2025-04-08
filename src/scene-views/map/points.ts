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

      try {
        const [points, minY] = tf.tidy(() => {
          // assume that lon and lat first two features. TODO: prop names/idxs in dsDef
          const coords = XRaw?.slice([0, 0], [-1, 2]).arraySync() as
            | number[][]
            | undefined
          const yScaled = scaleNormalize(y).arraySync() as number[]

          const yMax = y.max()
          const _yNorm = y.div(yMax)
          const minY = _yNorm.min().dataSync()[0]
          const yNorm = _yNorm.arraySync() as number[]

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
          return [points, minY]
        })
        setMinY(minY)
        setPoints(points)
      } catch (e) {
        console.warn(e)
      } finally {
        Object.values(data).forEach((t) => t?.dispose())
      }
    }
    getPoints()
  }, [subset, batchCount, ds, backendReady])
  return [points, minY] as const
}
