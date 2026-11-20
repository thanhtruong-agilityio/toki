// @vitest-environment jsdom
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { markSignedIn } from "@toki/client-core";
import { setPlatform } from "@toki/platform";
import { createWebPlatform } from "@toki/platform/web";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { AppProviders } from "../src/app-providers";
import { LANGUAGE_KEY, readDeviceLanguage } from "../src/auth/language";
import { setAuthServices } from "../src/auth/services";
import { timers } from "../src/client";
import { clock } from "../src/clock";
import { routeTree } from "../src/router";
import {
  createFakeCalls,
  createFakeEmergency,
  createFakeInvitation,
  user,
} from "./support/auth-harness";

beforeEach(() => {
  localStorage.clear();
  setPlatform(createWebPlatform());
  const calls = createFakeCalls();
  setAuthServices({
    calls,
    emergency: createFakeEmergency(),
    invitation: createFakeInvitation(),
    resetConversations: () => {},
    clock,
    timers,
  });
  markSignedIn(user);
});

async function mountApp() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await act(async () => {
    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );
  });
  await screen.findByTestId("shell");
}

describe("the providers of main.tsx (plan decision 5)", () => {
  test("with no language on the device the shell of TOKI-015 reads in English", async () => {
    await mountApp();
    expect(screen.getByRole("navigation")).toHaveAccessibleName("Main");
    expect(document.querySelector("a.ni")?.textContent).toBe("Home");
    expect(screen.getByTestId("app-root")).toHaveTextContent("Toki");
  });

  test("a language that is not one of ours is English", async () => {
    getStorage().device.set(LANGUAGE_KEY, "fr");
    await mountApp();
    expect(screen.getByRole("navigation")).toHaveAccessibleName("Main");
  });

  test("the language last used on the device is used", async () => {
    getStorage().device.set(LANGUAGE_KEY, "vi");
    await mountApp();
    expect(screen.getByRole("navigation")).toHaveAccessibleName(
      "Điều hướng chính",
    );
  });
});

describe("readDeviceLanguage", () => {
  test("en, vi, nothing and anything else", () => {
    const platform = createWebPlatform();
    expect(readDeviceLanguage(platform)).toBe("en");
    platform.storage.device.set(LANGUAGE_KEY, "vi");
    expect(readDeviceLanguage(platform)).toBe("vi");
    platform.storage.device.set(LANGUAGE_KEY, "de");
    expect(readDeviceLanguage(platform)).toBe("en");
  });
});

function getStorage() {
  const platform = createWebPlatform();
  setPlatform(platform);
  return platform.storage;
}
