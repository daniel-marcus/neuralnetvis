import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Neuro Vis",
  description:
    "Wrap your head around neural networks and watch machines learning",
  openGraph: {
    images: [{ url: "https://neurovis.app/images/neurovis-og.png" }],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
      </head>
      <body className={`antialiased`}>{children}</body>
    </html>
  )
}
