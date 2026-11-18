import { createTranslator, translate, type Translator } from "@toki/i18n";
import { describe, expect, it } from "vitest";
import { CODE_TTL_MINUTES, INVITATION_LIFETIME_DAYS } from "./lifetimes.js";
import {
  renderInvitationCodeMail,
  renderInvitationMail,
  renderSignInMail,
} from "./render.js";

const code = "493027";
const joinUrl =
  "https://toki.example.com/join#AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde";
const marker: Translator = (key) => `[[${key}]]`;
const absent = [
  "href",
  "<a",
  "http://",
  "https://",
  "www.",
  "<img",
  "<form",
  "<button",
  "<script",
];

describe("lifetimes (R26)", () => {
  it("pins 10 minutes (D-136) and 7 days (D-037)", () => {
    expect(CODE_TTL_MINUTES).toBe(10);
    expect(INVITATION_LIFETIME_DAYS).toBe(7);
  });
});

describe.each(["en", "vi"] as const)(
  "sign-in mail in %s (R7, R8)",
  (language) => {
    const t = createTranslator(language);
    const mail = renderSignInMail({ t, language, code });
    it("says what the table says", () => {
      expect(mail.subject).toBe(translate(language, "mail.signIn.subject"));
      expect(mail.text).toContain(translate(language, "mail.signIn.intro"));
      expect(mail.text).toContain(
        translate(language, "mail.signIn.validity", { minutes: 10 }),
      );
      expect(mail.text).toContain(translate(language, "mail.signIn.ignore"));
    });
    it("holds the code in one piece on both parts and not in the subject", () => {
      expect(mail.text).toContain(`\n${code}\n`);
      expect(mail.html).toContain(`>${code}<`);
      expect(mail.subject).not.toContain(code);
    });
    it("has no link, button or image", () => {
      for (const part of [mail.text, mail.html])
        for (const word of absent)
          expect(part.toLowerCase()).not.toContain(word);
    });
    it("sets the language of the HTML", () => {
      expect(mail.html).toContain(`lang="${language}"`);
    });
  },
);

describe.each(["en", "vi"] as const)(
  "new-code mail in %s (R24)",
  (language) => {
    const mail = renderInvitationCodeMail({
      t: createTranslator(language),
      language,
      code,
    });
    it("holds the texts, the code once in one piece and no link", () => {
      expect(mail.subject).toBe(
        translate(language, "mail.invitationCode.subject"),
      );
      expect(mail.text).toContain(
        translate(language, "mail.invitationCode.intro"),
      );
      expect(mail.text).toContain(
        translate(language, "mail.invitationCode.validity", { minutes: 10 }),
      );
      expect(mail.text).toContain(`\n${code}\n`);
      expect(mail.subject).not.toContain(code);
      for (const part of [mail.text, mail.html])
        for (const word of absent)
          expect(part.toLowerCase()).not.toContain(word);
    });
  },
);

describe("invitation mail (R9, R10, R12)", () => {
  const t = createTranslator("en");
  const base = {
    t,
    language: "en" as const,
    code,
    workspaceName: "Acme",
    inviterName: "Sam",
    joinUrl,
  };
  const mail = renderInvitationMail(base);

  it("names the workspace and the inviter, with the texts of the table", () => {
    expect(mail.subject).toBe("Sam invited you to Acme on Toki");
    expect(mail.text).toContain("Sam invited you to join Acme on Toki.");
    expect(mail.text).toContain(translate("en", "mail.invitation.codeIntro"));
    expect(mail.text).toContain(
      translate("en", "mail.invitation.validity", { minutes: 10 }),
    );
    expect(mail.text).toContain(
      translate("en", "mail.invitation.lifetime", { days: 7 }),
    );
    expect(mail.text).toContain(translate("en", "mail.invitation.ignore"));
    expect(mail.subject).not.toContain(code);
  });
  it("has one Join link with the address whole, and the address once in the text", () => {
    expect(mail.html.match(/<a[\s>]/g)).toHaveLength(1);
    expect(mail.html).toContain(`href="${joinUrl}"`);
    expect(mail.html).toContain(">Join</a>");
    expect(mail.text.split(joinUrl)).toHaveLength(2);
    expect(mail.text.split("\n")).toContain(joinUrl);
    expect(mail.text).toContain(`\n${code}\n`);
    expect(mail.html).toContain(`>${code}<`);
  });
  it("has no script, form, button or image", () => {
    for (const word of ["<form", "<button", "<script", "<img"])
      expect(mail.html.toLowerCase()).not.toContain(word);
  });
  it("escapes names as text and keeps header lines clean", () => {
    const hostile = renderInvitationMail({
      ...base,
      workspaceName: "<script>alert(1)</script>",
      inviterName: "Sam\r\nBcc: x@example.com",
    });
    expect(hostile.html).not.toContain("<script");
    expect(hostile.html).toContain("&lt;script&gt;");
    expect(hostile.subject).not.toMatch(/[\r\n]/);
    expect(hostile.subject).toContain("Sam Bcc: x@example.com");
  });
  it("escapes the address for an attribute", () => {
    const tricky = renderInvitationMail({
      ...base,
      joinUrl: 'https://toki.example.com/join?a="b"&c=d#tok',
    });
    expect(tricky.html).toContain(
      'href="https://toki.example.com/join?a=&quot;b&quot;&amp;c=d#tok"',
    );
    expect(tricky.html.match(/href=/g)).toHaveLength(1);
  });
  it("cuts a long name in the subject at 40 characters with an ellipsis", () => {
    const long = renderInvitationMail({
      ...base,
      workspaceName: "W".repeat(60),
    });
    expect(long.subject).toContain(`${"W".repeat(40)}…`);
    expect(long.text).toContain("W".repeat(60));
  });
});

describe("every visible word comes from a key (R22)", () => {
  it("leaves only markers, values and punctuation", () => {
    const values = [code, "Acme", "Sam", joinUrl];
    const strip = (part: string) => {
      let rest = part.replace(/<[^>]*>/g, " ").replace(/\[\[[^\]]+\]\]/g, " ");
      for (const value of values) rest = rest.split(value).join(" ");
      return rest.replace(/&[a-z]+;/g, " ").replace(/[\s\p{P}]+/gu, "");
    };
    const mails = [
      renderSignInMail({ t: marker, language: "en", code }),
      renderInvitationMail({
        t: marker,
        language: "en",
        code,
        workspaceName: "Acme",
        inviterName: "Sam",
        joinUrl,
      }),
      renderInvitationCodeMail({ t: marker, language: "en", code }),
    ];
    for (const mail of mails) {
      expect(strip(mail.text)).toBe("");
      expect(strip(mail.html.replace(/<style[\s\S]*?<\/style>/g, ""))).toBe("");
      expect(mail.subject).toMatch(/^\[\[mail\.[A-Za-z.]+\]\]$/);
    }
  });
});
