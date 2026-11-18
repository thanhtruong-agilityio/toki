import { describe, expect, test } from "vitest";
import { router, routeTree } from "../src/router";
import { appLayoutRoute } from "../src/routes/app-layout";
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
