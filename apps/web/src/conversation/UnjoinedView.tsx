import type { ChannelRead } from "@toki/client-core";
import { UnjoinedChannel } from "../features/channels/UnjoinedChannel";

// The page of an id that is not in the list and was never in it (TOKI-033 R21 (b)). Its body is
// TOKI-034's `UnjoinedChannel` (R16); the file and its four props are TOKI-033's.
export type UnjoinedViewProps = {
  channelId: string;
  onJoined: (channelId: string) => void;
  onMember: (detail: ChannelRead) => void;
  onNotFound: () => void;
};

export function UnjoinedView(props: UnjoinedViewProps) {
  return <UnjoinedChannel {...props} />;
}
