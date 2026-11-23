import type { Example } from "../../internal/example";
import { PersonChip } from "./PersonChip";

export const examples: Example[] = [
  {
    id: "default",
    title: "PersonChip",
    element: (
      <PersonChip
        name="Lan Nguyễn"
        hue={200}
        removeLabel="Remove Lan Nguyễn"
        onRemove={() => {}}
      />
    ),
  },
  {
    id: "long-name",
    title: "PersonChip with a long name",
    element: (
      <div style={{ width: 240 }}>
        <PersonChip
          name={"Nguyễn ".repeat(11).trim()}
          hue={40}
          removeLabel="Remove"
          onRemove={() => {}}
        />
      </div>
    ),
  },
];
