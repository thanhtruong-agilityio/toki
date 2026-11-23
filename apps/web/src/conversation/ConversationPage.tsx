import { useConversationSelector } from "../conversation-list/use-conversations";

// The seam for TOKI-035 (header, Details), TOKI-041 and TOKI-043: they replace the body and keep this
// file, its props and its test id (R21). Until then it draws the name of the conversation. It sits in
// the shell's `main`, so it is not a `main` itself.
export function ConversationPage({
  conversationId,
}: {
  conversationId: string;
  // The header's Back button of TOKI-035 calls it.
  onBack: () => void;
}) {
  const name = useConversationSelector((s) =>
    s.getConversationName(conversationId),
  );
  return (
    <div data-testid="conversation-page">
      <h1>{name}</h1>
    </div>
  );
}
