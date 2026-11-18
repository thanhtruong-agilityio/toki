import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { I18nProvider, useTranslation } from "./react";
import type { Language } from "./languages";

function Probe() {
  const { t, language } = useTranslation();
  return createElement("p", null, `${language}:${t("nav.home")}`);
}

const render = (language?: Language | "provider-less") =>
  renderToString(
    language === "provider-less"
      ? createElement(Probe)
      : createElement(
          I18nProvider,
          language === undefined ? {} : { language },
          createElement(Probe),
        ),
  ).replace(/<[^>]+>/g, "");

describe("I18nProvider and useTranslation (R10, R11)", () => {
  it("shows Vietnamese under language vi", () => {
    expect(render("vi")).toBe("vi:Trang chủ");
  });

  it("shows English under a provider with no language, and with no provider", () => {
    expect(render(undefined)).toBe("en:Home");
    expect(render("provider-less")).toBe("en:Home");
  });

  it("follows a change of language on the next render, with no copy of its own", () => {
    expect(render("en")).toBe("en:Home");
    expect(render("vi")).toBe("vi:Trang chủ");
    expect(render("en")).toBe("en:Home");
  });

  it("treats a language it does not know as English", () => {
    const unknown = (value: string) =>
      renderToString(
        createElement(
          I18nProvider,
          { language: value as Language },
          createElement(Probe),
        ),
      ).replace(/<[^>]+>/g, "");
    expect(unknown("fr")).toBe("en:Home");
    expect(unknown("vi-VN")).toBe("en:Home");
  });

  it("gives the same t for the same language, so a dependency list stays quiet", () => {
    const seen: unknown[] = [];
    function Collect() {
      seen.push(useTranslation().t);
      return null;
    }
    renderToString(
      createElement(I18nProvider, { language: "vi" }, createElement(Collect)),
    );
    renderToString(
      createElement(I18nProvider, { language: "vi" }, createElement(Collect)),
    );
    expect(seen[0]).toBe(seen[1]);
  });
});
