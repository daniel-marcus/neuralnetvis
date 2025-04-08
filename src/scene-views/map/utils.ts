import { WebMercatorViewport } from "@deck.gl/core"
import { InputGeoJSON } from "./types"
import { PLOT_HEIGHT, PLOT_WIDTH } from "./constants"

export function xyToPlot(
  [x, y]: [number, number],
  center = [0, 0]
): [number, number] {
  // x, y are normalized values (0-1)
  return [
    center[0] + (x - 0.5) * PLOT_WIDTH,
    center[1] - (y - 0.5) * PLOT_HEIGHT,
  ]
}

export function lngLatToScreen(
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

export function projectGeoJSON(
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
