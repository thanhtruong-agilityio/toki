import type { MailLayer } from "../src/modules/mail/index.js";

// A mail layer that records its calls and sends nothing (R21). An invitation
// mail to an address in `failFor` is recorded and answers as a mail server
// that cannot be reached; a test adds and removes addresses as it goes.
export function fakeMail() {
  const calls: Array<{ operation: string; input: unknown }> = [];
  const failFor = new Set<string>();
  const layer: MailLayer = {
    sendSignInMail: async (input) => {
      calls.push({ operation: "sendSignInMail", input });
      return { ok: true };
    },
    sendInvitationMail: async (input) => {
      calls.push({ operation: "sendInvitationMail", input });
      if (failFor.has(input.to)) return { ok: false, reason: "unavailable" };
      return { ok: true };
    },
    sendInvitationCode: async (input) => {
      calls.push({ operation: "sendInvitationCode", input });
      return { ok: true };
    },
  };
  return { layer, calls, failFor };
}
