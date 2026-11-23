import { describe, expect, test } from "vitest";
import { router, routeTree } from "../src/router";
import { adminRoute } from "../src/routes/admin";
import { appLayoutRoute } from "../src/routes/app-layout";
import { conversationRoute } from "../src/routes/conversation";
import { indexRoute } from "../src/routes/index";
import { rootRoute } from "../src/routes/__root";

// The folder this file sat in before the tests moved to tests/: its relative paths still start here.
const SRC_DIR = `${import.meta.dirname}/../src`;

describe("the route tree (R30)", () => {
  test("appLayoutRoute has the id _app, no path and the root as parent", () => {
    const options: { id?: string; path?: string } = appLayoutRoute.options;
    expect(options.id).toBe("_app");
    expect(options.path).toBeUndefined();
    expect(appLayoutRoute.options.getParentRoute()).toBe(rootRoute);
  });

  test("the index route is a child of appLayoutRoute", () => {
    expect(indexRoute.options.getParentRoute()).toBe(appLayoutRoute);
    expect(routeTree.children).toContain(appLayoutRoute);
    expect(routeTree.children).not.toContain(indexRoute);
    expect(appLayoutRoute.children).toContain(indexRoute);
  });

  test("the conversation route is /c/$conversationId, a child of appLayoutRoute, with the one search parameter panel=details (R21, TOKI-035 R8)", () => {
    expect(conversationRoute.options.getParentRoute()).toBe(appLayoutRoute);
    expect(appLayoutRoute.children).toContain(conversationRoute);
    const options = conversationRoute.options as unknown as { path?: string };
    expect(options.path).toBe("/c/$conversationId");
    const validate = conversationRoute.options.validateSearch as (
      search: Record<string, unknown>,
    ) => unknown;
    expect(validate({ panel: "details", x: 1 })).toEqual({ panel: "details" });
    expect(validate({ panel: "other", x: 1 })).toEqual({});
  });

  test("the Admin route is a child of appLayoutRoute with the path /admin and no search (TOKI-025 R1)", () => {
    expect(adminRoute.options.getParentRoute()).toBe(appLayoutRoute);
    const options: { path?: string; validateSearch?: unknown } =
      adminRoute.options;
    expect(options.path).toBe("/admin");
    expect(appLayoutRoute.children).toContain(adminRoute);
    expect(options.validateSearch).toBeUndefined();
  });

  test("the router is built from the tree", () => {
    expect(router.routeTree).toBe(routeTree);
  });
});

describe("no file-based routing (R30)", () => {
  test("there is no _app.tsx and no generated route file", async () => {
    const { existsSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = resolve(SRC_DIR);
    expect(existsSync(resolve(src, "routes/_app.tsx"))).toBe(false);
    expect(existsSync(resolve(src, "routeTree.gen.ts"))).toBe(false);
  });
});
