import type { Example } from "../../internal/example";
import { Badge, badgeVariants } from "./Badge";

export const examples: Example[] = [
  ...badgeVariants.map((variant) => ({
    id: `variant-${variant}`,
    title: `variant ${variant}`,
    element: (
      <Badge variant={variant}>{variant === "mention" ? "@" : "3"}</Badge>
    ),
  })),
  {
    id: "with-label",
    title: "with a label",
    element: <Badge label="3 unread">3</Badge>,
  },
];
