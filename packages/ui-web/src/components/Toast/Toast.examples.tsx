import type { Example } from "../../internal/example";
import { Toast } from "./Toast";

// A Toast on its own, with no provider and no timer: it stays on the page.
export const examples: Example[] = [
  {
    id: "plain",
    title: "without an action",
    element: <Toast text="Left #design" />,
  },
  {
    id: "action",
    title: "with an action",
    element: (
      <Toast text="Message deleted" action={{ label: "Undo", onPress() {} }} />
    ),
  },
  {
    id: "long",
    title: "long text",
    element: (
      <Toast
        text="Your message could not be sent because the connection was lost, and it will be sent again when you are back online."
        action={{ label: "Retry", onPress() {} }}
      />
    ),
  },
];
