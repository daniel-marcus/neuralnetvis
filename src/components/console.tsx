import { useState } from "react"

const appVersion = process.env.APP_VERSION

export const Console = () => {
  const [entries] = useState<string[]>([])
  return (
    <div className="fixed z-10 top-0 left-0 px-3 py-2 sm:p-4 text-gray-text pointer-events-none">
      <div>Neuro Vis {appVersion}</div>
      {entries.slice(-5).map((entry, i) => (
        <div key={i} dangerouslySetInnerHTML={{ __html: entry }}></div>
      ))}
    </div>
  )
}
