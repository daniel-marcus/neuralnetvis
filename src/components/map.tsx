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
import { getDbDataAsTensors } from "@/data/dataset"
import {
  LinearInterpolator,
  OrthographicView,
  OrthographicViewState,
  WebMercatorViewport,
} from "@deck.gl/core"

const PLOT_WIDTH = 300
const PLOT_HEIGHT = PLOT_WIDTH

export const Map = () => {
  const view = useSceneStore((s) => s.view)
  const isPlotView = view === "plot"
  const isMapView = view === "map"
  const isActive = useSceneStore((s) => s.isActive)

  const viewStateProps = useViewState()
  const layers = useLayers()

  return (
    <div
      className={`absolute pointer-events-none ${
        isActive
          ? isPlotView
            ? "z-30"
            : isMapView
            ? "pointer-events-auto!"
            : "md:translate-x-[25vw]"
          : "grayscale-25 opacity-75"
      } transition-all duration-[var(--tile-duration)] w-[100vw] h-[100dvh]`}
    >
      <DeckGL
        layers={layers}
        views={new OrthographicView()}
        controller
        {...viewStateProps}
      />
    </div>
  )
}

const pathStyleExtension = new PathStyleExtension({ dash: true })

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

function useLayers() {
  const view = useSceneStore((s) => s.view)
  const isPlotView = view === "plot"
  const mapProps = useSceneStore((s) => s.ds?.mapProps)

  const [points, minY] = usePoints()
  const sampleIdx = useSceneStore((s) => s.sampleIdx)
  const activePoint = useMemo(() => {
    if (!points || typeof sampleIdx === "undefined") return null
    return points[sampleIdx]
  }, [points, sampleIdx])

  const baseLayer = useMemo(() => {
    if (!mapProps?.baseLayer) return
    return projectGeoJSON(mapProps.baseLayer, mapProps.center, mapProps.zoom)
  }, [mapProps])

  const layers = useMemo(
    () => [
      new GeoJsonLayer({
        id: "geojson-layer",
        visible: !isPlotView,
        data: baseLayer ?? [],
        stroked: true,
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
            ? Float32Array.from(xyToPlot([d.yNorm, d.yPredNorm]))
            : [d.lon, d.lat],
        getRadius: () =>
          isPlotView && points
            ? Math.max(Math.floor(PLOT_WIDTH / points.length), 1)
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
        visible: isPlotView,
        data: [
          [xyToPlot([0, 0]), xyToPlot([1, 0])],
          [xyToPlot([0, 0]), xyToPlot([0, 1])],
        ],
        getPath: (d) => d,
        getColor: [140, 146, 164],
        getWidth: 0.25,
      }),
      new PathLayer({
        id: "middle-line",
        visible: isPlotView,
        data: [[xyToPlot([minY, minY]), xyToPlot([1, 1])]],
        getPath: (d) => d,
        getColor: [255, 20, 100], // [200, 255, 90], //
        getWidth: 1.4,
        extensions: [pathStyleExtension],
        getDashArray: [5, 3],
      }),
      new TextLayer({
        id: "axes-labels",
        visible: isPlotView,
        data: [
          {
            label: "actual",
            pos: xyToPlot([0.5, 0]),
            offset: [0, 16],
          },
          {
            label: "predicted",
            pos: xyToPlot([0, 0.5]),
            angle: 90,
            offset: [-16, 0],
          },
        ],
        getText: (d) => d.label,
        getPosition: (d) => d.pos,
        getPixelOffset: (d) => d.offset,
        getAngle: (d) => d.angle ?? 0,
        getColor: [140, 146, 164],
        fontFamily: "Menlo-Regular, Menlo",
        getSize: 16,
      }),
      new IconLayer<Point>({
        id: "active-point-layer",
        visible: !!mapProps && !isPlotView,
        data: activePoint ? [activePoint] : [],
        getPosition: (d: Point) => [d.lon, d.lat],
        getIcon: () => "marker",
        getSize: 40,
        getColor: [140, 146, 164], // text color
        opacity: 0.5,
        iconAtlas: "/images/icon-atlas.png",
        iconMapping,
      }),
    ],
    [activePoint, isPlotView, mapProps, points, minY, baseLayer]
  )

  return layers
}

const DEFAULT_VIEW: OrthographicViewState = {
  target: [0, 0, 0],
  zoom: 0,
}
const DESKTOP_ZOOM = 0.5
const MOBILE_ZOOM = 0
function getZoom() {
  return window.innerWidth > 640 ? DESKTOP_ZOOM : MOBILE_ZOOM
}

const orthographicInterpolator = new LinearInterpolator({
  transitionProps: ["target", "zoom"],
})

function useViewState() {
  const [viewState, setViewState] = useState(DEFAULT_VIEW)

  const view = useSceneStore((s) => s.view)
  useEffect(() => {
    if (view !== "map")
      setViewState({
        ...DEFAULT_VIEW,
        zoom: getZoom(),
        transitionDuration: 500,
        transitionInterpolator: orthographicInterpolator,
      })
  }, [view])

  useEffect(() => {
    function onResize() {
      setViewState((s) => ({ ...s, zoom: getZoom() }))
    }
    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])
  const onViewStateChange = (e: { viewState: OrthographicViewState }) =>
    setViewState(e.viewState)
  return { viewState, onViewStateChange }
}

function xyToPlot([x, y]: [number, number], center = [0, 0]): [number, number] {
  // x, y are normalized values (0-1)
  return [
    center[0] + (x - 0.5) * PLOT_WIDTH,
    center[1] - (y - 0.5) * PLOT_HEIGHT,
  ]
}

function lngLatToScreen(
  lngLat: [number, number],
  centerLngLat: [number, number],
  zoom: number
): [number, number] {
  // returns x, y as carthesian coordinates relative to center
  const WIDTH = 300
  const HEIGHT = 300
  const viewport = new WebMercatorViewport({
    width: WIDTH,
    height: HEIGHT,
    longitude: centerLngLat[0],
    latitude: centerLngLat[1],
    zoom,
  })
  const [x, y] = viewport.project(lngLat)
  return [x - WIDTH / 2, y - HEIGHT / 2]
}

type InputGeoJSON = GeoJSON.GeometryCollection | GeoJSON.FeatureCollection

function projectGeoJSON(
  input: InputGeoJSON,
  center: [number, number],
  zoom: number
): InputGeoJSON {
  const projectCoordinate = (coord: GeoJSON.Position): GeoJSON.Position => {
    const [x, y] = lngLatToScreen([coord[0], coord[1]], center, zoom)
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
  const viewSubset = useSceneStore((s) => s.viewSubset)
  const model = useSceneStore((s) => s.model)
  const batchCount = useSceneStore((s) => s.batchCount)
  useEffect(() => {
    if (!backendReady) return
    async function getAllSamples() {
      if (!model || !ds) return

      const data = await getDbDataAsTensors(ds, viewSubset, undefined, true)
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
              yPredNorm: yPredNorm[i],
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
    getAllSamples()
  }, [viewSubset, batchCount, ds, model, backendReady])
  return [points, minY] as const
}
