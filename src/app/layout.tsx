import { Suspense } from "react"
import { App } from "@/components/app"
import { metadata } from "./metadata"
import manifest from "./manifest.json"
import "./globals.css"

export { metadata }

type LayoutProps = Readonly<{ children: React.ReactNode }>

export default function Layout({ children }: LayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0" // , maximum-scale=1.0, user-scalable=no
        />
        <meta name="apple-mobile-web-app-title" content={`${metadata.title}`} />
        <meta
          name="theme-color"
          content={manifest.theme_color}
          id="theme-color"
        />
      </head>
      <body className={`antialiased`}>
        <Suspense>
          <App>{children}</App>
        </Suspense>
      </body>
    </html>
  )
}
