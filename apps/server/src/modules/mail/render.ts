import type { Language, Translator } from "@toki/i18n";
import { CODE_TTL_MINUTES, INVITATION_LIFETIME_DAYS } from "./lifetimes.js";

// Pure functions: the three mails as a subject, a text part and an HTML part
// (R7 to R12, R22, R24). Every visible word comes from `t`; a value from a
// person is escaped in the HTML and cleaned of control characters everywhere.
export type RenderedMail = { subject: string; text: string; html: string };

const SUBJECT_NAME_LIMIT = 40;

function clean(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cut(value: string): string {
  const chars = [...value];
  return chars.length > SUBJECT_NAME_LIMIT
    ? `${chars.slice(0, SUBJECT_NAME_LIMIT).join("")}…`
    : value;
}

const bodyStyle =
  "margin:0;padding:24px;background:#ffffff;color:#1a1a1a;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5";
const codeStyle =
  "margin:16px 0;font-family:Menlo,Consolas,monospace;font-size:32px;font-weight:bold;letter-spacing:4px";
const mutedStyle = "margin:8px 0;color:#555555;font-size:14px";
const buttonStyle =
  "display:inline-block;margin:16px 0;padding:12px 28px;background:#2a5bd7;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold";

function page(language: Language, blocks: string[]): string {
  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"></head><body style="${bodyStyle}">${blocks.join("")}</body></html>`;
}

const p = (text: string, style?: string) =>
  `<p style="${style ?? "margin:8px 0"}">${escapeHtml(text)}</p>`;
const codeBlock = (code: string) => `<p style="${codeStyle}">${code}</p>`;

type Base = { t: Translator; language: Language; code: string };

export function renderSignInMail({ t, language, code }: Base): RenderedMail {
  const intro = t("mail.signIn.intro");
  const validity = t("mail.signIn.validity", { minutes: CODE_TTL_MINUTES });
  const ignore = t("mail.signIn.ignore");
  return {
    subject: t("mail.signIn.subject"),
    text: [intro, "", code, "", validity, ignore, ""].join("\n"),
    html: page(language, [
      p(intro),
      codeBlock(code),
      p(validity, mutedStyle),
      p(ignore, mutedStyle),
    ]),
  };
}

export function renderInvitationCodeMail({
  t,
  language,
  code,
}: Base): RenderedMail {
  const intro = t("mail.invitationCode.intro");
  const validity = t("mail.invitationCode.validity", {
    minutes: CODE_TTL_MINUTES,
  });
  return {
    subject: t("mail.invitationCode.subject"),
    text: [intro, "", code, "", validity, ""].join("\n"),
    html: page(language, [p(intro), codeBlock(code), p(validity, mutedStyle)]),
  };
}

export function renderInvitationMail({
  t,
  language,
  code,
  workspaceName,
  inviterName,
  joinUrl,
}: Base & {
  workspaceName: string;
  inviterName: string;
  joinUrl: string;
}): RenderedMail {
  const workspace = clean(workspaceName);
  const inviter = clean(inviterName);
  const intro = t("mail.invitation.intro", { inviter, workspace });
  const join = t("mail.invitation.join");
  const codeIntro = t("mail.invitation.codeIntro");
  const validity = t("mail.invitation.validity", { minutes: CODE_TTL_MINUTES });
  const lifetime = t("mail.invitation.lifetime", {
    days: INVITATION_LIFETIME_DAYS,
  });
  const ignore = t("mail.invitation.ignore");
  return {
    subject: t("mail.invitation.subject", {
      inviter: cut(inviter),
      workspace: cut(workspace),
    }),
    text: [
      intro,
      "",
      joinUrl,
      "",
      codeIntro,
      "",
      code,
      "",
      validity,
      lifetime,
      ignore,
      "",
    ].join("\n"),
    html: page(language, [
      p(intro),
      `<a href="${escapeHtml(joinUrl)}" style="${buttonStyle}">${escapeHtml(join)}</a>`,
      p(codeIntro),
      codeBlock(code),
      p(validity, mutedStyle),
      p(lifetime, mutedStyle),
      p(ignore, mutedStyle),
    ]),
  };
}
