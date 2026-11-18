import type { Example } from "../../internal/example";
import { Icon } from "../../icons";
import { buttonSizes, buttonVariants, Button } from "./Button";

// Demo words are test data, not interface text (R26).
const variantExamples: Example[] = buttonVariants.map((variant) => ({
  id: `variant-${variant}`,
  title: `variant ${variant}`,
  element: <Button variant={variant}>Button</Button>,
}));

export const examples: Example[] = [
  ...variantExamples,
  ...buttonSizes.map((size) => ({
    id: `size-${size}`,
    title: `size ${size}`,
    element: <Button size={size}>Button</Button>,
  })),
  {
    id: "with-icon",
    title: "icon next to the text",
    element: (
      <Button variant="primary">
        <Icon name="plus" />
        Add
      </Button>
    ),
  },
  {
    id: "full-width",
    title: "fullWidth",
    element: (
      <Button variant="primary" fullWidth>
        Continue
      </Button>
    ),
  },
  {
    id: "disabled",
    title: "disabled",
    element: <Button disabled>Button</Button>,
  },
  {
    id: "link-disabled",
    title: "disabled link button",
    element: (
      <Button variant="link" disabled>
        Link
      </Button>
    ),
  },
];
