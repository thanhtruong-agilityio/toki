import type { Example } from "../../internal/example";
import { Select } from "./Select";

const options = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma", disabled: true },
];

export const examples: Example[] = [
  {
    id: "normal",
    title: "normal",
    element: <Select aria-label="Pick" options={options} />,
  },
  {
    id: "full-width",
    title: "fullWidth",
    element: <Select aria-label="Pick" options={options} fullWidth />,
  },
  {
    id: "with-label",
    title: "with a label",
    element: <Select label="Pick" options={options} />,
  },
  {
    id: "error",
    title: "error",
    element: <Select label="Pick" options={options} error="Demo error" />,
  },
  {
    id: "disabled",
    title: "disabled",
    element: <Select aria-label="Pick" options={options} disabled />,
  },
];
