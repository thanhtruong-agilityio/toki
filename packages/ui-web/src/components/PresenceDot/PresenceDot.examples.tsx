import type { Example } from "../../internal/example";
import { PresenceDot, presenceStates } from "./PresenceDot";

export const examples: Example[] = presenceStates.flatMap((state) => [
  {
    id: `${state}`,
    title: `${state}`,
    element: <PresenceDot state={state} />,
  },
  {
    id: `${state}-label`,
    title: `${state} with a label`,
    element: <PresenceDot state={state} label={state} />,
  },
]);
