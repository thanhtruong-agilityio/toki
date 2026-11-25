// The UI parity check compares images only inside the Playwright container, so that the reference
// images and the app are drawn by the same Chromium and the same fonts (TOKI-109 R10). The wrapper
// `tools/ui-parity/container.mjs` sets TOKI_PARITY_CONTAINER=1 inside the container.
export function assertInContainer(
  env: Record<string, string | undefined>,
): void {
  if (env.TOKI_PARITY_CONTAINER !== "1") {
    throw new Error(
      "parity: run through pnpm test:e2e:parity (the check compares only inside the Playwright container)",
    );
  }
}
