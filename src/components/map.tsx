"use client"

import DeckGL from "@deck.gl/react"
import { ScatterplotLayer, GeoJsonLayer, IconLayer } from "@deck.gl/layers"
import * as tf from "@tensorflow/tfjs"
import { useEffect, useMemo, useState } from "react"
import { useGlobalStore, useSceneStore } from "@/store"
import { getAll } from "@/data/db"
import california from "@/data/datasets/california.json"
import type { DbBatch } from "@/data"
import { scaleNormalize } from "@/data/utils"
import { getColorVals, NEG_BASE, POS_BASE } from "@/neuron-layers/colors"

const INITIAL_VIEW_STATE = {
  longitude: -120.5,
  latitude: 37.5,
  zoom: 5.8,
}

interface Point {
  lon: number
  lat: number
  y: number
}

const iconMapping = {
  marker: {
    x: 0,
    y: 0,
    width: 128,
    height: 128,
    anchorY: 128,
    mask: true,
  },
}

export const Map = () => {
  const isActive = useSceneStore((s) => s.isActive)
  const points = usePoints()
  const sampleIdx = useSceneStore((s) => s.sampleIdx)
  const activePoint = useMemo(() => {
    if (!points || typeof sampleIdx === "undefined") return null
    return points[sampleIdx]
  }, [points, sampleIdx])
  const layers = [
    new GeoJsonLayer({
      id: "geojson-layer",
      data: california as GeoJSON.GeometryCollection,
      stroked: true,
      filled: false,
      lineWidthScale: 20,
      lineWidthMinPixels: 1,
      getLineColor: [55, 60, 75],
    }),
    new ScatterplotLayer<Point>({
      id: "scatterplot-layer",
      data: points ?? [],
      opacity: 0.8,
      stroked: false,
      filled: true,
      radiusScale: 6,
      radiusMinPixels: 1,
      radiusMaxPixels: 100,
      lineWidthMinPixels: 1,
      getPosition: (d: Point) => [d.lon, d.lat],
      getRadius: () => 10,
      getFillColor: (d: Point) =>
        d.y >= 0 ? getColorVals(d.y, POS_BASE) : getColorVals(-d.y, NEG_BASE),
    }),
    new IconLayer<Point>({
      id: "active-point-layer",
      data: activePoint ? [activePoint] : [],
      getPosition: (d: Point) => [d.lon, d.lat],
      getIcon: () => "marker",
      getSize: 40,
      getColor: [140, 146, 164], // text color
      opacity: 0.5,
      iconAtlas: "/images/icon-atlas.png",
      iconMapping,
    }),
  ]
  return (
    <div
      className={`absolute ${
        isActive
          ? "grayscale-25 opacity-75 sm:grayscale-0 sm:opacity-100 md:translate-x-[25vw]"
          : "grayscale-25 opacity-75"
      } transition-all duration-[var(--tile-duration)] pointer-events-none w-[100vw] h-[100dvh]`}
    >
      <DeckGL
        layers={layers}
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
      />
    </div>
  )
}

function usePoints() {
  const backendReady = useGlobalStore((s) => s.backendReady)
  const [points, setPoints] = useState<Point[] | null>(null)
  const dsKey = useSceneStore((s) => s.ds?.key)
  const inputDims = useSceneStore((s) => s.ds?.inputDims)
  useEffect(() => {
    if (!backendReady) return
    async function getAllSamples() {
      if (!dsKey || !inputDims) return
      const batches = await getAll<DbBatch>(dsKey, "train")
      if (!batches.length || !batches.find((b) => !!b.xsRaw)) return
      const points = tf.tidy(() => {
        const xBatchTensors = batches.map((b) => tf.tensor(b.xsRaw!))
        const shapeX = [-1, ...inputDims]
        // assume that lon and lat first two features
        const coords = tf
          .concat(xBatchTensors)
          .reshape(shapeX)
          .slice([0, 0], [-1, 2])
          .arraySync() as number[][]
        const yArr = batches.flatMap((b) => Array.from(b.ys))
        const y = tf.tensor(yArr)
        const yNormalized = scaleNormalize(y).arraySync() as number[]
        const points = coords.map((c, i) => ({
          lon: c[0],
          lat: c[1],
          y: yNormalized[i],
        }))
        return points
      })
      setPoints(points)
    }
    getAllSamples()
  }, [dsKey, inputDims, backendReady])
  return points
}
