import type { AppearanceOptions } from "@toki/ui-web";

// The look and the scheme of the shell fixture, from its address (TOKI-015 R32, TOKI-143 R11):
// `?look=calm|focus|classic` and `?scheme=light|dark|device`. An absent or unknown value is Calm
// and `device`, the default of the app.
const looks = ["calm", "focus", "classic"] as const;
const schemes = ["light", "dark", "device"] as const;

export function appearanceFromAddress(
  params: URLSearchParams,
): Pick<AppearanceOptions, "look" | "scheme"> {
  const look = looks.find((l) => l === params.get("look")) ?? "calm";
  const scheme = schemes.find((s) => s === params.get("scheme")) ?? "device";
  return { look, scheme };
}
