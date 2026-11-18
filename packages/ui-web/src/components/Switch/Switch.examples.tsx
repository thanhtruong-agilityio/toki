import type { Example } from "../../internal/example";
import { Switch } from "./Switch";

const noop = () => {};

export const examples: Example[] = [
  {
    id: "checked-false",
    title: "off",
    element: <Switch checked={false} label="Option" onChange={noop} />,
  },
  {
    id: "checked-true",
    title: "on",
    element: <Switch checked label="Option" onChange={noop} />,
  },
  {
    id: "disabled",
    title: "disabled",
    element: <Switch checked={false} label="Option" disabled onChange={noop} />,
  },
];
