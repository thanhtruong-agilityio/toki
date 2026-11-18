import type { Example } from "../../internal/example";
import { Field } from "./Field";

export const examples: Example[] = [
  {
    id: "variant-default",
    title: "default",
    element: <Field label="Name" placeholder="Demo" />,
  },
  {
    id: "variant-code",
    title: "code",
    element: <Field label="Code" variant="code" defaultValue="123456" />,
  },
  {
    id: "variant-search",
    title: "search with an icon",
    element: (
      <Field
        variant="search"
        icon="search"
        aria-label="Search"
        placeholder="Search"
      />
    ),
  },
  {
    id: "search-no-icon",
    title: "search without an icon",
    element: <Field variant="search" aria-label="Find" placeholder="Find" />,
  },
  {
    id: "no-label",
    title: "input without a visible label",
    element: <Field aria-label="Status" placeholder="Status" />,
  },
  {
    id: "textarea",
    title: "textarea",
    element: <Field label="Note" multiline rows={3} />,
  },
  {
    id: "error",
    title: "error",
    element: <Field label="Email" error="Demo error" />,
  },
  {
    id: "read-only",
    title: "readOnly",
    element: <Field label="Email" readOnly defaultValue="demo" />,
  },
  {
    id: "disabled",
    title: "disabled",
    element: <Field label="Email" disabled defaultValue="demo" />,
  },
  {
    id: "search-error",
    title: "search with error",
    element: <Field variant="search" aria-label="s1" error="Demo error" />,
  },
  {
    id: "search-read-only",
    title: "search readOnly",
    element: (
      <Field variant="search" aria-label="s2" readOnly defaultValue="demo" />
    ),
  },
  {
    id: "search-disabled",
    title: "search disabled",
    element: (
      <Field variant="search" aria-label="s3" disabled defaultValue="demo" />
    ),
  },
];
