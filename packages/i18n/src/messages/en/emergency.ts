// The texts of the emergency link page (TOKI-026 R46, concern 14). The page is in no prototype
// screen, so every text is a proposal (D-139); a change of words changes only this file.
export const emergency = {
  title: "Emergency sign-in",
  description: "This link signs you in without a code. It works once.",
  submit: "Sign in",
  switch: {
    question: "You are signed in as {current}. Sign out to continue?",
    confirm: "Sign out and continue",
    cancel: "Stay signed in",
  },
  invalid:
    "This link is not valid. Ask the person who runs your Toki server for a new one.",
  deactivated: "Account deactivated",
  failed: "Can't reach Toki. Try again.",
  rateLimited: {
    one: "Too many attempts from this network. Try again in {count} minute.",
    other: "Too many attempts from this network. Try again in {count} minutes.",
  },
};
