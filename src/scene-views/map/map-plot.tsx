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
import { clearStatus, setStatus, useGlobalStore, useSceneStore } from "@/store"
import { scaleNormalize } from "@/data/utils"
import { getColorVals, NEG_BASE, POS_BASE } from "@/utils/colors"
import { getDbDataAsTensors } from "@/data/dataset"
import {
  LinearInterpolator,
  OrthographicView,
  OrthographicViewState,
  WebMercatorViewport,
} from "@deck.gl/core"
import { Table } from "../../components/ui-elements"
import { round } from "@/scene-views/3d-model/label"

const PLOT_WIDTH = 300
const PLOT_HEIGHT = PLOT_WIDTH

export const MapPlot = () => {
  const view = useSceneStore((s) => s.view)
  const isActive = useSceneStore((s) => s.isActive)
  const viewStateProps = useViewState()
  const layers = useLayers()
  useCurrSampleStatus(isActive && view === "map")

  return (
    <div
      className={`absolute pointer-events-none ${
        isActive
          ? view === "evaluation"
            ? "z-30"
            : view === "map"
            ? `pointer-events-auto!`
            : "md:translate-x-[25vw]"
          : "grayscale-25 opacity-75"
      } transition-all duration-[var(--tile-duration)] w-[100vw] h-[100dvh]`}
    >
      <DeckGL
        layers={layers}
        views={new OrthographicView()}
        controller
        getCursor={({ isDragging, isHovering }) =>
          isDragging ? "grabbing" : isHovering ? "pointer" : "grab"
        }
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
  const mapProps = useSceneStore((s) => s.ds?.mapProps)

  const [points, minY] = usePoints()
  const sampleIdx = useSceneStore((s) => s.sampleIdx)
  const setSampleIdx = useSceneStore((s) => s.setSampleIdx)
  const activePoint = useMemo(() => {
    if (!points || typeof sampleIdx === "undefined") return null
    return points[sampleIdx]
  }, [points, sampleIdx])

  const [baseLayer, setBaseLayer] = useState<InputGeoJSON | null>(null)
  useEffect(() => {
    async function getBaseLayer() {
      if (!mapProps || !mapProps.baseLayer) return // || !isActive
      const geojson =
        typeof mapProps.baseLayer === "string"
          ? await fetch(mapProps.baseLayer).then((r) => r.json())
          : mapProps.baseLayer
      setBaseLayer(projectGeoJSON(geojson, mapProps.center, mapProps.zoom))
    }
    getBaseLayer()
  }, [mapProps])

  const subset = useSceneStore((s) => s.subset)

  const predictions = useSceneStore((s) => s.evaluation.predictions)

  const layers = useMemo(
    () => [
      new GeoJsonLayer({
        id: "geojson-layer",
        visible: view !== "evaluation",
        data: baseLayer ?? [],
        stroked: true,
        filled: false,
        getLineWidth: 0.5,
        getLineColor: [55, 60, 75],
      }),
      new ScatterplotLayer<Point>({
        id: `scatterplot-layer-${subset}`,
        data: mapProps || view === "evaluation" ? points ?? [] : [],
        stroked: false,
        filled: true,
        lineWidthMinPixels: 1,
        getPosition: (d: Point, { index: idx }) =>
          view === "evaluation"
            ? Float32Array.from(
                xyToPlot([d.yNorm, predictions?.[idx]?.normPredicted ?? 0])
              )
            : [d.lon, d.lat],
        getRadius: () =>
          view === "evaluation" && points
            ? Math.max(Math.floor((PLOT_WIDTH / points.length) * 0.8), 1)
            : 0.5,
        getFillColor: (d: Point) =>
          view === "evaluation"
            ? [200, 255, 90]
            : d.y >= 0
            ? getColorVals(d.y, POS_BASE)
            : getColorVals(-d.y, NEG_BASE),
        pickable: view === "map",
        onClick: ({ index }) => {
          setSampleIdx((currIdx) => (index === currIdx ? undefined : index))
        },
        updateTriggers: {
          getRadius: [view],
          getPosition: [view, predictions],
          getFillColor: [view],
        },
        transitions: {
          getRadius: 500,
          getPosition: 500,
          getFillColor: 500,
        },
      }),
      new PathLayer({
        id: "coordinate-axes",
        visible: view === "evaluation",
        data: [
          [xyToPlot([0, 0]), xyToPlot([1, 0])],
          [xyToPlot([0, 0]), xyToPlot([0, 1])],
        ],
        getPath: (d) => d,
        getColor: [150, 156, 171],
        getWidth: 0.25,
      }),
      new PathLayer({
        id: "middle-line",
        visible: view === "evaluation",
        data: [[xyToPlot([minY, minY]), xyToPlot([1, 1])]],
        getPath: (d) => d,
        getColor: [255, 20, 100], // [200, 255, 90], //
        getWidth: 1.4,
        extensions: [pathStyleExtension],
        getDashArray: [5, 3],
      }),
      new TextLayer({
        id: "axes-labels",
        visible: view === "evaluation",
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
        getColor: [150, 156, 171],
        fontFamily: "Menlo-Regular, Menlo",
        getSize: 16,
      }),
      new IconLayer<Point>({
        id: "active-point-layer",
        visible: !!mapProps && view !== "evaluation",
        data: activePoint ? [activePoint] : [],
        getPosition: (d: Point) => [d.lon, d.lat],
        getIcon: () => "marker",
        getSize: 40,
        getColor: [150, 156, 171], // text color
        opacity: 0.5,
        iconAtlas: "/images/icon-atlas.png",
        iconMapping,
      }),
    ],
    [
      activePoint,
      mapProps,
      points,
      minY,
      baseLayer,
      subset,
      view,
      setSampleIdx,
      predictions,
    ]
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

function useCurrSampleStatus(isActive?: boolean) {
  const sample = useSceneStore((s) => s.sample)
  const ds = useSceneStore((s) => s.ds)
  useEffect(() => {
    if (!isActive || !sample || !ds?.inputLabels) return
    const values = sample.rawX ?? sample.X
    const outputLabel = ds.outputLabels?.[0] ?? "y"
    const dataEntries = [
      ...ds.inputLabels.map((label, i) => [label, round(values[i])]),
      [outputLabel, round(sample.y)],
    ]
    const data = Object.fromEntries(dataEntries)
    const STATUS_ID = "sample-status"
    if (data)
      setStatus(<Table data={data} />, undefined, {
        id: STATUS_ID,
      })
    return () => clearStatus(STATUS_ID)
  }, [isActive, sample, ds])
}
