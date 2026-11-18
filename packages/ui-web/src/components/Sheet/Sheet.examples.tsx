import { useRef, useState } from "react";
import type { Example } from "../../internal/example";
import { Button } from "../Button/Button";
import { Sheet } from "./Sheet";

function OpenDemo({ rows }: { rows: number }) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button ref={opener} onClick={() => setOpen(true)}>
        Open
      </Button>
      <Sheet
        open={open}
        title="Demo sheet"
        closeLabel="Close"
        returnFocusRef={opener}
        onRequestClose={() => setOpen(false)}
      >
        {Array.from({ length: rows }, (_, i) => (
          <Button key={i} variant="ghost" fullWidth>
            Demo row {i + 1}
          </Button>
        ))}
      </Sheet>
    </>
  );
}

export const examples: Example[] = [
  { id: "rows", title: "a list of rows", element: <OpenDemo rows={4} /> },
  {
    id: "long-body",
    title: "a body taller than the window",
    element: <OpenDemo rows={40} />,
  },
];
