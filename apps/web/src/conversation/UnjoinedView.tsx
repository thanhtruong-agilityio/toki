import type { ChannelRead } from "@toki/client-core";
import { NotFoundView } from "../routes/NotFoundView";

// The page of an id that is not in the list and was never in it (R21 (b)). In this ticket it draws
// the not-found view and nothing else; TOKI-034 replaces the body with `UnjoinedChannel` and keeps this
// file and these four props.
export type UnjoinedViewProps = {
  channelId: string;
  onJoined: (channelId: string) => void;
  onMember: (detail: ChannelRead) => void;
  onNotFound: () => void;
};

export function UnjoinedView(props: UnjoinedViewProps) {
  void props;
  return <NotFoundView />;
}
