import type { NextConfig } from "next"
import { version } from "./package.json"

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
  experimental: {
    turbo: {
      minify: false,
    },
  }, */
}

export default nextConfig
