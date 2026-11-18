import type { Example } from "./internal/example";
import { examples as avatar } from "./components/Avatar/Avatar.examples";
import { examples as badge } from "./components/Badge/Badge.examples";
import { examples as button } from "./components/Button/Button.examples";
import { examples as chip } from "./components/Chip/Chip.examples";
import { examples as emptyState } from "./components/EmptyState/EmptyState.examples";
import { examples as field } from "./components/Field/Field.examples";
import { examples as iconButton } from "./components/IconButton/IconButton.examples";
import { examples as presenceDot } from "./components/PresenceDot/PresenceDot.examples";
import { examples as select } from "./components/Select/Select.examples";
import { examples as switchExamples } from "./components/Switch/Switch.examples";
import { examples as tag } from "./components/Tag/Tag.examples";
import { examples as toast } from "./components/Toast/Toast.examples";

export type { Example } from "./internal/example";

// One entry for each component, group 1 first (the examples of ChipGroup are in
// the Chip entry). A component of group 2 adds one import and one entry after
// these (R26, R31). The preview page imports `@toki/ui-web/examples`.
export const componentExamples: Array<{
  component: string;
  examples: Example[];
}> = [
  { component: "Button", examples: button },
  { component: "IconButton", examples: iconButton },
  { component: "Chip", examples: chip },
  { component: "Switch", examples: switchExamples },
  { component: "Field", examples: field },
  { component: "Select", examples: select },
  { component: "Tag", examples: tag },
  { component: "Badge", examples: badge },
  { component: "Avatar", examples: avatar },
  { component: "PresenceDot", examples: presenceDot },
  { component: "EmptyState", examples: emptyState },
  { component: "Toast", examples: toast },
];
