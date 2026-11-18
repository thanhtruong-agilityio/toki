import type { ReactNode } from "react";
import type { Example } from "../../internal/example";
import { Button } from "../Button/Button";
import { Menu, type MenuAlign } from "./Menu";
import { MenuGroup, MenuSeparator } from "./MenuGroup";
import { MenuItem } from "./MenuItem";
import { useMenuTrigger } from "./useMenuTrigger";

// A Button that opens a Menu. The owner closes it on every reason, so that Esc
// closes it and focus goes back to the Button (R30).
function Demo({ align, children }: { align?: MenuAlign; children: ReactNode }) {
  const trigger = useMenuTrigger<HTMLButtonElement>();
  return (
    <>
      <Button {...trigger.triggerProps}>Open</Button>
      <Menu {...trigger.menuProps} align={align} aria-label="Demo menu">
        {children}
      </Menu>
    </>
  );
}

const plain = (
  <>
    <MenuItem>Demo item one</MenuItem>
    <MenuItem>Demo item two</MenuItem>
    <MenuItem>Demo item three</MenuItem>
  </>
);

export const examples: Example[] = [
  {
    id: "default",
    title: "align end",
    element: <Demo align="end">{plain}</Demo>,
  },
  {
    id: "start",
    title: "align start",
    element: <Demo align="start">{plain}</Demo>,
  },
  {
    id: "groups",
    title: "group headings and separators",
    element: (
      <Demo>
        <MenuGroup label="Demo status">
          <MenuItem>Demo active</MenuItem>
          <MenuItem>Demo away</MenuItem>
          <MenuItem>Demo do not disturb</MenuItem>
        </MenuGroup>
        <MenuSeparator />
        <MenuGroup label="Demo account">
          <MenuItem>Demo profile</MenuItem>
          <MenuItem>Demo preferences</MenuItem>
          <MenuItem>Demo notifications</MenuItem>
        </MenuGroup>
        <MenuSeparator />
        <MenuGroup label="Demo workspace">
          <MenuItem>Demo invite</MenuItem>
          <MenuItem>Demo admin</MenuItem>
          <MenuItem>Demo sign out</MenuItem>
        </MenuGroup>
      </Demo>
    ),
  },
  {
    id: "danger",
    title: "a danger item",
    element: (
      <Demo>
        <MenuItem>Demo edit</MenuItem>
        <MenuItem variant="danger">Demo delete</MenuItem>
      </Demo>
    ),
  },
  {
    id: "disabled",
    title: "a disabled item",
    element: (
      <Demo>
        <MenuItem>Demo edit</MenuItem>
        <MenuItem disabled>Demo locked</MenuItem>
      </Demo>
    ),
  },
  {
    id: "icon",
    title: "items with an icon",
    element: (
      <Demo>
        <MenuItem icon="edit">Demo edit</MenuItem>
        <MenuItem icon="copy">Demo copy</MenuItem>
        <MenuItem icon="trash" variant="danger">
          Demo delete
        </MenuItem>
      </Demo>
    ),
  },
];
