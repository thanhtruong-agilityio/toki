import type { Example } from "../../internal/example";
import { Button } from "../Button";
import { EmptyState } from "./EmptyState";

export const examples: Example[] = [
  {
    id: "default",
    title: "without an action",
    element: (
      <EmptyState
        icon="users"
        title="Nobody matches"
        description="Try a name or a job title."
      />
    ),
  },
  {
    id: "action",
    title: "with an action",
    element: (
      <EmptyState
        icon="users"
        title="You are all caught up"
        description="Mentions, thread replies and reactions will show up as they happen."
        action={<Button variant="primary">Open</Button>}
      />
    ),
  },
  {
    id: "filtered",
    title: "after a search",
    element: (
      <EmptyState
        icon="users"
        title="Nobody matches"
        description="Try a name or a job title."
        filtered
      />
    ),
  },
];
