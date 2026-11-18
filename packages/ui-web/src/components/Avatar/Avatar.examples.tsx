import type { Example } from "../../internal/example";
import { presenceStates } from "../PresenceDot/PresenceDot";
import { Avatar } from "./Avatar";

// The sizes that the screens of the lists, the header and the profile use
// (the preview page spec asks for them, TOKI-016 concern 6 a).
const sizes = [18, 24, 30, 64];

export const examples: Example[] = [
  {
    id: "density",
    title: "density size",
    element: <Avatar name="Lan Nguyễn" hue={172} />,
  },
  {
    id: "size-46",
    title: "size 46",
    element: <Avatar name="Minh Trần" hue={215} size={46} />,
  },
  ...sizes.map((size) => ({
    id: `size-${size}`,
    title: `size ${size}`,
    element: <Avatar name="Alex Phạm" hue={28} size={size} />,
  })),
  ...presenceStates.map((state) => ({
    id: `presence-${state}`,
    title: `presence ${state}`,
    element: <Avatar name="Sam Lê" hue={330} size={46} presence={state} />,
  })),
  {
    id: "one-word",
    title: "one-word name",
    element: <Avatar name="Thu" hue={265} size={46} />,
  },
  {
    id: "long-name",
    title: "long name",
    element: <Avatar name="Khoa Đỗ Nguyễn Trần Quang Vũ" hue={95} size={46} />,
  },
];
