import type { MetadataRoute } from "next"
import { siteMeta } from "../../metadata"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteMeta.title,
    short_name: siteMeta.title,
    description: siteMeta.description,
    start_url: "/",
    display: "standalone",
    background_color: "#110000",
    theme_color: "#dc1464",
    icons: [
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
