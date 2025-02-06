import { useTabStore } from "@/components/menu"
import { Box, InlineButton } from "@/ui-components"

export function Info() {
  const setTabByKey = useTabStore((s) => s.setTabByKey)
  return (
    <Box padding>
      <p className="mb-4">
        Wrap your head around neural networks and watch machines learn!
      </p>
      <p className="mb-4">
        If you are new to the topic, you might want to start with the{" "}
        <InlineButton onClick={() => setTabByKey("learn")}>learn</InlineButton>{" "}
        section.
      </p>
      <p className="mb-4">
        Otherwise, dive in, modify or train models, and{" "}
        <InlineButton onClick={() => setTabByKey("play")}>play</InlineButton>{" "}
        with neural networks – all within your browser!
      </p>
      <p className="text-right">
        v{process.env.APP_VERSION}
        <br />© 2025 by{" "}
        <a
          className="text-accent"
          target="_blank"
          href="https://danielmarcus.de/"
        >
          Daniel Marcus
        </a>
      </p>
    </Box>
  )
}
