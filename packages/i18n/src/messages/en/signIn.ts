// The texts of the sign-in page (TOKI-023). Wordings signed off on 2026-11-19.
export const signIn = {
  pageTitle: "Sign in · Toki",
  card: {
    platform: "on Toki",
  },
  email: {
    label: "Email",
    submit: "Send code",
    invalid: "Enter a valid email address",
  },
  code: {
    title: "Check your email",
    validity: "The code works for 10 minutes",
    label: "Code",
    submit: "Sign in",
    changeEmail: "Use a different email",
    resend: "Resend code",
    resendWait: "Resend code in {count} s",
    resent: "We sent a new code.",
    sendNew: "Send a new code",
  },
  error: {
    wrongCode: {
      one: "That code is not right. {count} try left.",
      other: "That code is not right. {count} tries left.",
    },
    locked: "This code is locked. Ask for a new one.",
    expired: "This code has expired",
    tooMany: {
      one: "You have asked for too many codes. Try again in {count} minute.",
      other: "You have asked for too many codes. Try again in {count} minutes.",
    },
    resendTooSoon: {
      one: "A code was just sent. Try again in {count} second.",
      other: "A code was just sent. Try again in {count} seconds.",
    },
    deactivated: "This account has been deactivated. Contact an admin.",
    network: "Could not connect. Check your network and try again.",
    general: "Something went wrong. Try again.",
  },
};
