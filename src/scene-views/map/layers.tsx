import { useEffect, useMemo, useState } from "react"
import {
  ScatterplotLayer,
  GeoJsonLayer,
  IconLayer,
  PathLayer,
  TextLayer,
} from "@deck.gl/layers"
import { PathStyleExtension } from "@deck.gl/extensions"
import { useSceneStore } from "@/store"
import { getColorVals, NEG_BASE, POS_BASE } from "@/utils/colors"
import { usePoints } from "./points"
import { InputGeoJSON, Point } from "./types"
import { projectGeoJSON, xyToPlot } from "./utils"
import { PLOT_WIDTH } from "./constants"

const pathStyleExtension = new PathStyleExtension({ dash: true })

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

export function useLayers() {
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
