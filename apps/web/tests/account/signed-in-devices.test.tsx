// @vitest-environment jsdom
import { I18nProvider } from "@toki/i18n/react";
import type { Language } from "@toki/i18n";
import type { SessionItem } from "@toki/shared";
import { ToastProvider } from "@toki/ui-web";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { sessions } from "../../src/client";
import { SignedInDevices } from "../../src/account/SignedInDevices";
import { setConnectionCheck } from "../../src/patterns/online";

// The date context is fixed: 12:00 UTC on Mon 16 Nov 2026, in UTC.
const ctx = vi.hoisted(() => ({
  value: {
    timeZone: "UTC",
    now: Date.parse("2026-11-16T12:00:00Z"),
    language: "en",
    dayWords: { today: "Today", tomorrow: "Tomorrow", yesterday: "Yesterday" },
  },
}));
vi.mock("../../src/account/use-date-context", () => ({
  useDateContext: () => ctx.value,
}));

const row = (over: Partial<SessionItem> = {}): SessionItem => ({
  id: "s1",
  current: false,
  deviceKind: "phone",
  browser: "safari",
  lastUsedAt: "2026-11-16T09:00:00Z",
  ...over,
});
const laptop = row({
  id: "me",
  current: true,
  deviceKind: "desktop",
  browser: "chrome",
  lastUsedAt: "2026-11-16T15:00:00Z",
});
const phone = row({ id: "p1" });

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
const httpError = (status: number, code = "x") =>
  Object.assign(new Error(code), { kind: "http", status, code });

async function mount(language: Language = "en") {
  await act(async () => {
    render(
      <I18nProvider language={language}>
        <ToastProvider>
          <SignedInDevices />
        </ToastProvider>
      </I18nProvider>,
    );
  });
}
const list = (...rows: SessionItem[][]) => {
  const spy = vi.spyOn(sessions, "list");
  for (const r of rows) spy.mockResolvedValueOnce(r);
  return spy;
};

const english = { ...ctx.value };
afterEach(() => {
  ctx.value = { ...english };
  vi.restoreAllMocks();
  setConnectionCheck(null);
});

describe("the section and its states (R14)", () => {
  test("shows the heading as an h2 and Loading while nothing is held", async () => {
    vi.spyOn(sessions, "list").mockReturnValue(new Promise(() => {}));
    await mount();
    const h = screen.getByRole("heading", { level: 2 });
    expect(h).toHaveTextContent("Signed-in devices");
    expect(h).toHaveAttribute("tabindex", "-1");
    expect(h).toHaveClass("devshead");
    expect(screen.getByText("Loading devices")).toBeTruthy();
    expect(document.querySelector(".devs")).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  test("a failed first read shows the error and Try again, which reads again", async () => {
    const spy = vi
      .spyOn(sessions, "list")
      .mockRejectedValueOnce(httpError(500))
      .mockResolvedValueOnce([laptop]);
    await mount();
    expect(screen.getByText("Could not load the devices.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("This device")).toBeTruthy();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Could not load the devices.")).toBeNull();
  });

  test("a reload keeps the rows in the document while it runs, and a failed one keeps them too", async () => {
    const second = deferred<SessionItem[]>();
    vi.spyOn(sessions, "list")
      .mockResolvedValueOnce([laptop, phone])
      .mockReturnValueOnce(second.promise);
    await mount();
    const button = screen.getByRole("button", { name: /^Sign out Safari/ });
    // "Sign out all other devices" reads the list again
    await userEvent.click(
      screen.getByRole("button", { name: "Sign out all other devices" }),
    );
    expect(button.isConnected).toBe(true);
    expect(document.querySelector(".devs")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await act(async () => second.reject(httpError(500)));
    expect(button.isConnected).toBe(true);
    expect(screen.getByText("Could not load the devices.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("a row (R15, R16)", () => {
  test("a phone and a laptop: one This device, the time lines, the order of the server", async () => {
    list([phone, laptop]);
    await mount();
    expect(screen.getAllByText("This device")).toHaveLength(1);
    const rows = [...document.querySelectorAll(".devrow")];
    expect(rows).toHaveLength(2);
    expect(
      within(rows[0] as HTMLElement).getByText("Safari · Phone"),
    ).toBeTruthy();
    expect(
      within(rows[1] as HTMLElement).getByText("Chrome · Desktop"),
    ).toBeTruthy();
    expect(
      within(rows[1] as HTMLElement).getByText("This device"),
    ).toBeTruthy();
    expect(screen.getByText("Last used Today 09:00")).toBeTruthy();
    expect(screen.getByText("Last used Today 15:00")).toBeTruthy();
  });

  test("unknown codes read as Unknown browser and Unknown device", async () => {
    list([row({ id: "u", browser: "unknown", deviceKind: "unknown" }), laptop]);
    await mount();
    expect(screen.getByText("Unknown browser · Unknown device")).toBeTruthy();
  });

  test("the code other reads Other browser", async () => {
    list([row({ id: "o", browser: "other", deviceKind: "tablet" }), laptop]);
    await mount();
    expect(screen.getByText("Other browser · Tablet")).toBeTruthy();
  });

  test.each(["not a date", "", "x"])(
    "a bad date %j leaves the time line out and shows no Invalid Date or NaN",
    async (lastUsedAt) => {
      list([row({ lastUsedAt }), laptop]);
      await mount();
      expect(document.body.textContent).not.toMatch(/Invalid Date|NaN/);
      expect(screen.getAllByText(/^Last used/)).toHaveLength(1);
      // The button of the row is named by the title alone.
      expect(
        screen.getByRole("button", { name: "Sign out Safari · Phone" }),
      ).toBeTruthy();
    },
  );

  test("a button on every other row and none on the current one, with a name that names the device", async () => {
    list([phone, laptop]);
    await mount();
    const buttons = screen.getAllByRole("button", { name: /^Sign out Safari/ });
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName(
      "Sign out Safari · Phone (last used Today 09:00)",
    );
    const current = document.querySelectorAll(".devrow")[1]!;
    expect(within(current as HTMLElement).queryByRole("button")).toBeNull();
  });

  test("two rows of one kind, browser and minute get '1 of 2' and '2 of 2' in their names", async () => {
    list([row({ id: "a" }), row({ id: "b" }), laptop]);
    await mount();
    const names = screen
      .getAllByRole("button", { name: /^Sign out Safari/ })
      .map((b) => b.getAttribute("aria-label"));
    expect(names).toEqual([
      "Sign out Safari · Phone (last used Today 09:00), 1 of 2",
      "Sign out Safari · Phone (last used Today 09:00), 2 of 2",
    ]);
  });

  test("a date other than today reads as 'Last used Mon 16 Nov 09:00'; in Vietnamese the mixed form", async () => {
    ctx.value = { ...english, now: Date.parse("2026-11-23T12:00:00Z") };
    list([row({ lastUsedAt: "2026-11-16T09:00:00Z" }), laptop]);
    await mount();
    expect(screen.getByText("Last used Mon 16 Nov 09:00")).toBeTruthy();
  });

  test("the Vietnamese time line of another day keeps the English weekday and month (TOKI-094 R8)", async () => {
    ctx.value = {
      ...english,
      language: "vi",
      now: Date.parse("2026-11-23T12:00:00Z"),
      dayWords: {
        today: "Hôm nay",
        tomorrow: "Ngày mai",
        yesterday: "Hôm qua",
      },
    };
    list([row({ lastUsedAt: "2026-11-16T09:00:00Z" }), laptop]);
    await mount("vi");
    expect(screen.getByText("Dùng lần cuối Mon 16 Nov 09:00")).toBeTruthy();
  });

  test("in Vietnamese the day word of the time line is Vietnamese", async () => {
    ctx.value = {
      ...english,
      language: "vi",
      dayWords: {
        today: "Hôm nay",
        tomorrow: "Ngày mai",
        yesterday: "Hôm qua",
      },
    };
    list([phone, laptop]);
    await mount("vi");
    expect(screen.getByText("Dùng lần cuối Hôm nay 15:00")).toBeTruthy();
    expect(screen.getByText("Dùng lần cuối Hôm nay 09:00")).toBeTruthy();
  });

  test("in Vietnamese the words are Vietnamese", async () => {
    list([phone, laptop]);
    await mount("vi");
    expect(screen.getByText("Thiết bị đã đăng nhập")).toBeTruthy();
    expect(screen.getByText("Thiết bị này")).toBeTruthy();
    expect(screen.getByText("Safari · Điện thoại")).toBeTruthy();
    expect(screen.getByText(/^Dùng lần cuối .*09:00$/)).toBeTruthy();
  });
});

describe("the confirmation for one device (R17)", () => {
  async function openOne() {
    await userEvent.click(
      screen.getByRole("button", { name: /^Sign out Safari/ }),
    );
    return screen.getByRole("dialog");
  }

  test("names the device and the question; Cancel, Esc and an outside press send nothing", async () => {
    list([phone, laptop]);
    const end = vi.spyOn(sessions, "endOne");
    await mount();
    for (const close of [
      () => userEvent.click(screen.getByRole("button", { name: "Cancel" })),
      () => userEvent.keyboard("{Escape}"),
      () => userEvent.click(document.querySelector(".scrim") as HTMLElement),
    ]) {
      const dialog = await openOne();
      expect(dialog).toHaveTextContent("Sign out this device?");
      expect(dialog).toHaveTextContent(
        "Safari · Phone (last used Today 09:00)",
      );
      await close();
      expect(screen.queryByRole("dialog")).toBeNull();
    }
    expect(end).not.toHaveBeenCalled();
  });

  test("Confirm sends one endOne with the id, closes and reads the list again", async () => {
    const spy = list([phone, laptop], [laptop]);
    const end = vi.spyOn(sessions, "endOne").mockResolvedValue(undefined);
    await mount();
    const dialog = await openOne();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Sign out" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(end).toHaveBeenCalledExactlyOnceWith("p1");
    expect(spy).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Safari · Phone")).toBeNull();
  });

  test("a second press while busy sends none", async () => {
    list([phone, laptop], [laptop]);
    const gate = deferred<void>();
    const end = vi.spyOn(sessions, "endOne").mockReturnValue(gate.promise);
    await mount();
    const dialog = await openOne();
    const confirm = within(dialog).getByRole("button", { name: "Sign out" });
    await userEvent.click(confirm);
    await userEvent.click(confirm);
    expect(end).toHaveBeenCalledTimes(1);
    await act(async () => gate.resolve());
  });

  test("a 404 with the id gone from the next list closes the dialog without a toast", async () => {
    list([phone, laptop], [laptop]);
    vi.spyOn(sessions, "endOne").mockRejectedValue(httpError(404, "not_found"));
    await mount();
    const dialog = await openOne();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Sign out" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByText("That did not work. Try again.")).toBeNull();
  });

  test("a 404 with the id still in the list keeps the dialog and shows one toast", async () => {
    list([phone, laptop], [phone, laptop]);
    vi.spyOn(sessions, "endOne").mockRejectedValue(httpError(404, "not_found"));
    await mount();
    const dialog = await openOne();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Sign out" }),
    );
    expect(
      await screen.findByText("That did not work. Try again."),
    ).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  test("a 500 keeps the dialog open with one toast and the buttons enabled", async () => {
    list([phone, laptop]);
    vi.spyOn(sessions, "endOne").mockRejectedValue(httpError(500));
    await mount();
    const dialog = await openOne();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Sign out" }),
    );
    expect(
      await screen.findByText("That did not work. Try again."),
    ).toBeTruthy();
    const again = within(screen.getByRole("dialog")).getByRole("button", {
      name: "Sign out",
    });
    expect(again).not.toBeDisabled();
  });
});

describe("Sign out all other devices (R18)", () => {
  test.each([
    [1, "1 other device"],
    [2, "2 other devices"],
    [3, "3 other devices"],
  ])("with %i others the dialog names '%s'", async (count, text) => {
    const others = Array.from({ length: count }, (_, i) =>
      row({ id: `o${i}` }),
    );
    list([laptop, ...others], [laptop, ...others]);
    await mount();
    await userEvent.click(
      screen.getByRole("button", { name: "Sign out all other devices" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(text);
    expect(dialog).toHaveTextContent(
      `${count} other device${count === 1 ? "" : "s"} will be signed out. This device stays signed in.`,
    );
  });

  test("with no other device there is no button and the line says so", async () => {
    list([laptop]);
    await mount();
    expect(
      screen.queryByRole("button", { name: "Sign out all other devices" }),
    ).toBeNull();
    expect(screen.getByText("No other devices are signed in.")).toBeTruthy();
  });

  test("a list that grew between the first read and the press gives the new count", async () => {
    list(
      [laptop, phone],
      [laptop, phone, row({ id: "p2" }), row({ id: "p3" })],
    );
    await mount();
    await userEvent.click(
      screen.getByRole("button", { name: "Sign out all other devices" }),
    );
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "3 other devices",
    );
  });

  test("a read that finds no other device opens no dialog", async () => {
    list([laptop, phone], [laptop]);
    await mount();
    await userEvent.click(
      screen.getByRole("button", { name: "Sign out all other devices" }),
    );
    await waitFor(() =>
      expect(screen.getByText("No other devices are signed in.")).toBeTruthy(),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("Confirm calls endOthers once; a 204 closes and reads again; a 404 is an error", async () => {
    const spy = list([laptop, phone], [laptop, phone], [laptop]);
    const end = vi
      .spyOn(sessions, "endOthers")
      .mockRejectedValueOnce(httpError(404, "not_found"))
      .mockResolvedValueOnce(undefined);
    await mount();
    await userEvent.click(
      screen.getByRole("button", { name: "Sign out all other devices" }),
    );
    let dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: "Sign out all other devices",
      }),
    );
    expect(
      await screen.findByText("That did not work. Try again."),
    ).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    dialog = screen.getByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: "Sign out all other devices",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(end).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledTimes(3);
  });
});

describe("focus after a row has gone (R19)", () => {
  test("after the confirmed row leaves, focus is on the h2; the opener was in the document while the list reloaded", async () => {
    const second = deferred<SessionItem[]>();
    vi.spyOn(sessions, "list")
      .mockResolvedValueOnce([laptop, phone])
      .mockReturnValueOnce(second.promise);
    vi.spyOn(sessions, "endOne").mockResolvedValue(undefined);
    await mount();
    const opener = screen.getByRole("button", { name: /^Sign out Safari/ });
    await userEvent.click(opener);
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Sign out",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(opener.isConnected).toBe(true);
    await act(async () => second.resolve([laptop]));
    expect(opener.isConnected).toBe(false);
    expect(screen.getByRole("heading", { level: 2 })).toHaveFocus();
  });

  test("Cancel leaves focus on the row's button", async () => {
    list([laptop, phone]);
    await mount();
    const opener = screen.getByRole("button", { name: /^Sign out Safari/ });
    await userEvent.click(opener);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(opener).toHaveFocus();
  });

  test("a confirmed row that is not the first also moves focus to the h2", async () => {
    const a = row({ id: "a", browser: "firefox" });
    list([laptop, a, phone], [laptop, a]);
    vi.spyOn(sessions, "endOne").mockResolvedValue(undefined);
    await mount();
    await userEvent.click(
      screen.getByRole("button", { name: /^Sign out Safari/ }),
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Sign out",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 2 })).toHaveFocus(),
    );
  });
});

describe("offline (R20)", () => {
  test("Confirm calls nothing, the dialog stays open and the explanation shows", async () => {
    list([laptop, phone]);
    const end = vi.spyOn(sessions, "endOne");
    setConnectionCheck(() => false);
    await mount();
    await userEvent.click(
      screen.getByRole("button", { name: /^Sign out Safari/ }),
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Sign out",
      }),
    );
    expect(end).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(
      await screen.findByText(
        "You are offline. Try again when the connection is back.",
      ),
    ).toBeTruthy();
  });

  test("the confirmation for all other devices calls nothing while offline", async () => {
    list([laptop, phone], [laptop, phone]);
    const end = vi.spyOn(sessions, "endOthers");
    await mount();
    await userEvent.click(
      screen.getByRole("button", { name: "Sign out all other devices" }),
    );
    const dialog = await screen.findByRole("dialog");
    setConnectionCheck(() => false);
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: "Sign out all other devices",
      }),
    );
    expect(end).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(
      await screen.findByText(
        "You are offline. Try again when the connection is back.",
      ),
    ).toBeTruthy();
  });

  test("the read is not blocked while offline", async () => {
    const spy = list([laptop]);
    setConnectionCheck(() => false);
    await mount();
    expect(spy).toHaveBeenCalled();
    expect(screen.getByText("This device")).toBeTruthy();
  });
});
