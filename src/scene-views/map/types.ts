export interface Point {
  lon: number
  lat: number
  y: number
  yNorm: number
}

export type InputGeoJSON =
  | GeoJSON.GeometryCollection
  | GeoJSON.FeatureCollection
