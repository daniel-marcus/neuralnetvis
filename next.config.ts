import withBundleAnalyzer from "@next/bundle-analyzer"
// import TerserPlugin from "terser-webpack-plugin"
import { version } from "./package.json"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // reactStrictMode: false,
  output: "export",
  env: {
    APP_VERSION: version,
  },
  /*
  // Disable `typeofs` transformation for multi-threaded tfjs-backend-wasm (see: https://github.com/tensorflow/tfjs/tree/master/tfjs-backend-wasm#js-minification)
  webpack(config, { isServer }) {
    if (!isServer) {
      config.optimization.minimizer = [
        new TerserPlugin({
          terserOptions: {
            compress: {
              typeofs: false,
            },
          },
        }),
      ]
    }
    return config
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
      {
        source: "/wasm/:path*",
        headers: [
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ]
  }, */
}

const config =
  process.env.ANALYZE === "true" ? withBundleAnalyzer()(nextConfig) : nextConfig

export default config
