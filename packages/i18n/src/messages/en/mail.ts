// The texts of the mails the server sends (TOKI-021). Invitations are sent in English (D-180).
export const mail = {
  signIn: {
    subject: "Your Toki sign-in code",
    intro: "Use this code to sign in to Toki:",
    validity: "The code works for {minutes} minutes and can be used once.",
    ignore: "If you did not ask for this code, you can ignore this email.",
  },
  invitation: {
    subject: "{inviter} invited you to {workspace} on Toki",
    intro: "{inviter} invited you to join {workspace} on Toki.",
    join: "Join",
    codeIntro: "Press Join, then enter this code:",
    validity:
      "The code works for {minutes} minutes. If it has expired, press Resend code on the next page.",
    lifetime: "The invitation lasts {days} days.",
    ignore: "If you did not expect this invitation, you can ignore this email.",
  },
  invitationCode: {
    subject: "Your new Toki code",
    intro:
      "Here is your new code to join Toki. Enter it on the page you have open:",
    validity:
      "The code works for {minutes} minutes. Earlier codes no longer work.",
  },
};
