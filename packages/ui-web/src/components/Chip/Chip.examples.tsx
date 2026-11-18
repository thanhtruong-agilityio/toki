import type { Example } from "../../internal/example";
import { Chip, ChipGroup, chipSizes } from "./Chip";

export const examples: Example[] = [
  ...chipSizes.map((size) => ({
    id: `size-${size}`,
    title: `size ${size}`,
    element: <Chip size={size}>Chip</Chip>,
  })),
  { id: "pressed-true", title: "pressed", element: <Chip pressed>Chip</Chip> },
  {
    id: "pressed-false",
    title: "not pressed",
    element: <Chip pressed={false}>Chip</Chip>,
  },
  { id: "disabled", title: "disabled", element: <Chip disabled>Chip</Chip> },
  {
    id: "group",
    title: "ChipGroup",
    element: (
      <ChipGroup aria-label="Filter">
        <Chip pressed>One</Chip>
        <Chip pressed={false}>Two</Chip>
        <Chip pressed={false}>Three</Chip>
      </ChipGroup>
    ),
  },
];
