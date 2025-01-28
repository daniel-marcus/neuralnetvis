import { useState } from "react"

export const Console = () => {
  const [entries] = useState<string[]>([])
  return (
    <div className="fixed top-0 left-0 p-4 text-gray-600 pointer-events-none">
      <div>Neuro Vis {process.env.APP_VERSION}</div>
      {entries.slice(-5).map((entry, i) => (
        <div key={i} dangerouslySetInnerHTML={{ __html: entry }}></div>
      ))}
    </div>
  )
}
