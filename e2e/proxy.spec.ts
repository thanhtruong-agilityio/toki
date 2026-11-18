import { expect, test } from "@playwright/test";

// R23: a request to the web app reaches the server through the dev proxy and
// returns the server's own reply. Stopping the server, or aiming the proxy at
// another port, makes this fail.
test("the web app proxies /healthz and /api/v1 to the server", async ({
  request,
}) => {
  const health = await request.get("/healthz");
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: "ok" });

  // An unknown path under /api/v1 is answered by the server's error schema,
  // not by the web app's index page.
  const missing = await request.get("/api/v1/no-such-route");
  expect(missing.status()).toBe(404);
  expect(missing.headers()["content-type"]).toContain("application/json");
  expect((await missing.json()).error.code).toBeTruthy();
});
