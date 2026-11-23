// The place of the message list of an archived channel (R14). TOKI-041 replaces this body with the
// list and keeps the file, the props and its test id, as TOKI-033 R21 does for `ConversationPage`.
export function ArchivedHistory({ channelId }: { channelId: string }) {
  void channelId;
  return null;
}
