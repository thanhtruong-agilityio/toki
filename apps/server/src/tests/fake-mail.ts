import type { MailLayer } from "../modules/mail/index.js";

// A mail layer that records its calls and sends nothing (R21).
export function fakeMail() {
  const calls: Array<{ operation: string; input: unknown }> = [];
  const layer: MailLayer = {
    sendSignInMail: async (input) => {
      calls.push({ operation: "sendSignInMail", input });
      return { ok: true };
    },
    sendInvitationMail: async (input) => {
      calls.push({ operation: "sendInvitationMail", input });
      return { ok: true };
    },
    sendInvitationCode: async (input) => {
      calls.push({ operation: "sendInvitationCode", input });
      return { ok: true };
    },
  };
  return { layer, calls };
}
