import type { Example } from "../../internal/example";
import { IconButton, iconButtonSizes } from "./IconButton";

export const examples: Example[] = [
  ...iconButtonSizes.map((size) => ({
    id: `size-${size}`,
    title: `size ${size}`,
    element: <IconButton icon="x" label="Close" size={size} />,
  })),
  {
    id: "pressed-true",
    title: "pressed",
    element: <IconButton icon="check" label="Saved" pressed />,
  },
  {
    id: "pressed-false",
    title: "not pressed",
    element: <IconButton icon="check" label="Save" pressed={false} />,
  },
  {
    id: "disabled",
    title: "disabled",
    element: <IconButton icon="x" label="Close" disabled />,
  },
];
