// The texts of the Join page (TOKI-097 R35, R36, R39). The code step reuses the keys of `signIn`. The
// wordings were accepted as written by the product owner (concern 2); the prototype has no page for a
// member invitation. {current} and {invited} are addresses: data, not translated text.
export const join = {
  notFound: { title: "This link is not valid" },
  expired: {
    title: "This invitation has expired",
    body: "Ask the person who invited you for a new one.",
  },
  revoked: {
    title: "This invitation is no longer valid",
    body: "Ask an admin.",
  },
  signedIn: {
    question:
      "You are signed in as {current}. Sign out to continue as {invited}?",
    signOut: "Sign out and continue",
    stay: "Stay signed in",
  },
};
