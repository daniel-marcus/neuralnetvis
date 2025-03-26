"use client"

import DeckGL from "@deck.gl/react"
import {
  ScatterplotLayer,
  GeoJsonLayer,
  IconLayer,
  PathLayer,
  TextLayer,
} from "@deck.gl/layers"
import { PathStyleExtension } from "@deck.gl/extensions"
import * as tf from "@tensorflow/tfjs"
import { useEffect, useMemo, useState } from "react"
import { useGlobalStore, useSceneStore } from "@/store"
import { scaleNormalize } from "@/data/utils"
import { getColorVals, NEG_BASE, POS_BASE } from "@/neuron-layers/colors"
import { useKeyCommand } from "@/utils/key-command"
import { getDbDataAsTensors } from "@/data/dataset"
import {
  OrthographicView,
  OrthographicViewState,
  WebMercatorViewport,
} from "@deck.gl/core"

const pathStyleExtension = new PathStyleExtension({ dash: true })

const PLOT_WIDTH = 300
const PLOT_HEIGHT = PLOT_WIDTH

interface Point {
  lon: number
  lat: number
  y: number
  yNorm: number
  yPredNorm: number
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
  const view = useSceneStore((s) => s.view)
  const toggleView = useSceneStore((s) => s.toggleView)
  const isPlotView = view === "plot"
  const isActive = useSceneStore((s) => s.isActive)
  useKeyCommand("g", toggleView, isActive)

  const mapProps = useSceneStore((s) => s.ds?.mapProps)

  const [points, minY] = usePoints()
  const sampleIdx = useSceneStore((s) => s.sampleIdx)
  const activePoint = useMemo(() => {
    if (!points || typeof sampleIdx === "undefined") return null
    return points[sampleIdx]
  }, [points, sampleIdx])

  const _center = mapProps?.center ?? [0, 0]
  const center = lngLatToScreen(_center, _center)

  const baseLayer = useMemo(() => {
    if (!mapProps?.baseLayer) return
    return projectGeoJSON(mapProps.baseLayer, mapProps.center)
  }, [mapProps])

  const layers = [
    new GeoJsonLayer({
      id: "geojson-layer",
      data: baseLayer ?? [],
      stroked: isPlotView ? false : true,
      filled: false,
      getLineWidth: 0.5,
      getLineColor: [55, 60, 75],
    }),
    new ScatterplotLayer<Point>({
      id: "scatterplot-layer",
      data: !mapProps && !isPlotView ? [] : points ?? [],
      opacity: 1,
      stroked: false,
      filled: true,
      lineWidthMinPixels: 1,
      getPosition: (d: Point) =>
        isPlotView
          ? [
              center[0] + (d.yNorm - 0.5) * PLOT_WIDTH,
              center[1] - (d.yPredNorm - 0.5) * PLOT_HEIGHT,
            ]
          : [d.lon, d.lat],
      getRadius: () =>
        isPlotView && points
          ? Math.max(Math.floor((PLOT_WIDTH / points.length) * 3), 1)
          : 0.5,
      getFillColor: (d: Point) =>
        isPlotView
          ? [200, 255, 90]
          : d.y >= 0
          ? getColorVals(d.y, POS_BASE)
          : getColorVals(-d.y, NEG_BASE),
      updateTriggers: {
        getRadius: [isPlotView],
        getPosition: [isPlotView],
        getFillColor: [isPlotView],
      },
      transitions: {
        getRadius: 500,
        getPosition: 500,
        getFillColor: 500,
      },
    }),
    new PathLayer({
      id: "coordinate-axes",
      data: isPlotView
        ? [
            {
              // x-axis
              sourcePosition: [
                center[0] - PLOT_WIDTH / 2,
                center[1] + PLOT_HEIGHT / 2,
              ],
              targetPosition: [
                center[0] + PLOT_WIDTH / 2,
                center[1] + PLOT_HEIGHT / 2,
              ],
            },
            {
              // y-axis
              sourcePosition: [
                center[0] - PLOT_WIDTH / 2,
                center[1] + PLOT_HEIGHT / 2,
              ],
              targetPosition: [
                center[0] - PLOT_WIDTH / 2,
                center[1] - PLOT_HEIGHT / 2,
              ],
            },
          ]
        : [],
      getPath: (d) => [d.sourcePosition, d.targetPosition],
      getColor: [140, 146, 164],
      getWidth: 0.25,
    }),
    new PathLayer({
      id: "middle-line",
      visible: isPlotView,
      data: [
        {
          // middle line
          sourcePosition: [
            // bottom left
            center[0] + (minY - 0.5) * PLOT_WIDTH,
            center[1] - (minY - 0.5) * PLOT_HEIGHT,
          ],
          targetPosition: [
            // top right
            center[0] + PLOT_WIDTH / 2,
            center[1] - PLOT_HEIGHT / 2,
          ],
        },
      ],
      getPath: (d) => [d.sourcePosition, d.targetPosition],
      getColor: [255, 20, 100], // [200, 255, 90], //
      getWidth: 2,
      extensions: [pathStyleExtension],
      getDashArray: [5, 3],
    }),
    new TextLayer({
      id: "axes-labels",
      visible: isPlotView,
      data: [
        {
          label: "actual",
          coordinates: [center[0], center[1] + PLOT_HEIGHT / 2 + 10],
        },
        {
          label: "predicted",
          coordinates: [center[0] - PLOT_WIDTH / 2 - 10, center[1]],
          angle: 90,
        },
      ],
      getText: (d) => d.label,
      getPosition: (d) => d.coordinates,
      getAngle: (d) => d.angle ?? 0,
      getColor: [140, 146, 164],
      fontFamily: "Menlo-Regular, Menlo",
      getSize: 16,
    }),
    !!mapProps &&
      new IconLayer<Point>({
        id: "active-point-layer",
        data: activePoint && !isPlotView ? [activePoint] : [],
        getPosition: (d: Point) => [d.lon, d.lat],
        getIcon: () => "marker",
        getSize: 40,
        getColor: [140, 146, 164], // text color
        opacity: 0.5,
        iconAtlas: "/images/icon-atlas.png",
        iconMapping,
      }),
  ].filter(Boolean)

  const [viewState, setViewState] = useState<OrthographicViewState>({
    target: [...center, 0],
    zoom: 0,
  })
  useEffect(() => {
    function onResize() {
      const DESKTOP_ZOOM = 1
      const MOBILE_ZOOM = 0
      if (window.innerWidth > 640)
        setViewState((s) => ({ ...s, zoom: DESKTOP_ZOOM }))
      else setViewState((s) => ({ ...s, zoom: MOBILE_ZOOM }))
    }
    onResize()
    window.addEventListener("resize", onResize)
    return () => {
      window.removeEventListener("resize", onResize)
    }
  }, [])

  return (
    <div
      className={`absolute ${
        isActive
          ? `${
              isPlotView
                ? "z-30"
                : "md:translate-x-[25vw] grayscale-25 opacity-75 sm:grayscale-0 sm:opacity-100 "
            }`
          : "grayscale-25 opacity-75"
      } transition-all duration-[var(--tile-duration)] pointer-events-none w-[100vw] h-[100dvh]`}
    >
      <DeckGL
        layers={layers}
        views={new OrthographicView()}
        viewState={viewState}
        onViewStateChange={(e) => {
          setViewState(e.viewState as OrthographicViewState)
        }}
      />
    </div>
  )
}

function lngLatToScreen(
  lngLat: [number, number],
  center: [number, number]
): [number, number] {
  const viewport = new WebMercatorViewport({
    width: 600,
    height: 600,
    longitude: center[0],
    latitude: center[1],
    zoom: 4.8, // ?
  })
  const [x, y] = viewport.project(lngLat)
  return [x, y]
}

type InputGeoJSON = GeoJSON.GeometryCollection | GeoJSON.FeatureCollection

function projectGeoJSON(
  input: InputGeoJSON,
  center: [number, number]
): InputGeoJSON {
  const projectCoordinate = (coord: GeoJSON.Position): GeoJSON.Position => {
    const [x, y] = lngLatToScreen([coord[0], coord[1]], center)
    return [x, y]
  }

  const processGeometry = (geometry: GeoJSON.Geometry): GeoJSON.Geometry => {
    switch (geometry.type) {
      case "Point":
        return {
          ...geometry,
          coordinates: projectCoordinate(geometry.coordinates),
        }

      case "LineString":
        return {
          ...geometry,
          coordinates: geometry.coordinates.map(projectCoordinate),
        }

      case "Polygon":
        return {
          ...geometry,
          coordinates: geometry.coordinates.map((ring) =>
            ring.map(projectCoordinate)
          ),
        }

      case "MultiPoint":
        return {
          ...geometry,
          coordinates: geometry.coordinates.map(projectCoordinate),
        }

      case "MultiLineString":
        return {
          ...geometry,
          coordinates: geometry.coordinates.map((line) =>
            line.map(projectCoordinate)
          ),
        }

      case "MultiPolygon":
        return {
          ...geometry,
          coordinates: geometry.coordinates.map((polygon) =>
            polygon.map((ring) => ring.map(projectCoordinate))
          ),
        }

      case "GeometryCollection":
        return {
          ...geometry,
          geometries: geometry.geometries.map(processGeometry),
        }

      default:
        return geometry
    }
  }

  if (input.type === "FeatureCollection") {
    return {
      ...input,
      features: input.features.map((feature) => ({
        ...feature,
        geometry: processGeometry(feature.geometry),
      })),
    }
  }

  // GeometryCollection
  return {
    ...input,
    geometries: input.geometries.map(processGeometry),
  }
}

function usePoints() {
  const backendReady = useGlobalStore((s) => s.backendReady)
  const [points, setPoints] = useState<Point[] | null>(null)
  const [minY, setMinY] = useState<number>(0)
  const ds = useSceneStore((s) => s.ds)
  const model = useSceneStore((s) => s.model)
  const batchCount = useSceneStore((s) => s.batchCount)
  useEffect(() => {
    if (!backendReady) return
    async function getAllSamples() {
      if (!model || !ds) return

      const data = await getDbDataAsTensors(ds, "train", undefined, true)
      if (!data) return
      const { X, y, XRaw } = data

      try {
        const [points, minY] = tf.tidy(() => {
          // assume that lon and lat first two features
          const coords = XRaw?.slice([0, 0], [-1, 2]).arraySync() as
            | number[][]
            | undefined
          const yScaled = scaleNormalize(y).arraySync() as number[]

          const yMax = y.max()
          const _yNorm = y.div(yMax)
          const minY = _yNorm.min().dataSync()[0]
          const yNorm = _yNorm.arraySync() as number[]
          const yPredNorm = (model.predict(X) as tf.Tensor)
            .flatten()
            .div(yMax)
            .arraySync() as number[]

          const points =
            Array.from({ length: yScaled.length }).map((_, i) => {
              const c = (coords?.[i] as [number, number]) ?? [0, 0]
              return {
                lon: ds.mapProps
                  ? lngLatToScreen(c, ds.mapProps.center)[0] ?? 0
                  : 0,
                lat: ds.mapProps
                  ? lngLatToScreen(c, ds.mapProps.center)[1] ?? 0
                  : 0,
                y: yScaled[i],
                yNorm: yNorm[i],
                yPredNorm: yPredNorm[i],
              }
            }) ?? []
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
    getAllSamples()
  }, [batchCount, ds, model, backendReady])
  return [points, minY] as const
}

/* how much is the latitude stretched at a given latitude
function getMercatorDistortion(latitudeDeg: number): number {
  const phi = (latitudeDeg * Math.PI) / 180 // Convert to radians
  return 1 / Math.cos(phi)
} */
