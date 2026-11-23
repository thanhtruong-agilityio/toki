// @vitest-environment jsdom
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ConversationHeader } from "../../src/conversation/ConversationHeader";
import { DetailsPanel } from "../../src/conversation/DetailsPanel";
import { setConnectionCheck } from "../../src/patterns/online";
import {
  detail,
  http,
  useFakeApi,
  type FakeApiHarness,
} from "../support/conversation-api";
import { mountConversation } from "../support/conversation-mount";
import {
  channel,
  dm,
  person,
  workspaceBody,
} from "../support/conversation-store";

vi.mock("../../src/client", async () =>
  (await import("../support/conversation-store")).clientModule(),
);

let h: FakeApiHarness;
const onNoAccess = vi.fn();

beforeEach(async () => {
  onNoAccess.mockReset();
  h = useFakeApi(
    workspaceBody(
      [
        channel("c1", "project-launch", { notificationLevel: "mentions" }),
        // Another conversation of the same person, with other values: they never show in c1's panel.
        channel("c2", "other", {
          notificationLevel: "none",
          isMuted: true,
          isStarred: true,
        }),
        channel("gen", "general", {
          isGeneral: true,
          notificationLevel: "all",
        }),
        dm("d1", "p1", { notificationLevel: "all" }),
      ],
      [person("p1", "Alex")],
    ),
    {
      details: [
        detail("c1", "project-launch"),
        detail("c2", "other"),
        detail("gen", "general", { isGeneral: true }),
      ],
    },
  );
  await h.loadNow();
});
afterEach(() => setConnectionCheck(null));

const open = (id = "c1") =>
  mountConversation(
    (cid) => (
      <>
        <ConversationHeader conversationId={cid} onBack={() => {}} />
        <DetailsPanel conversationId={cid} onNoAccess={onNoAccess} />
      </>
    ),
    { path: `/c/${id}?panel=details` },
  );

const notifications = () =>
  screen.getByRole("heading", { level: 3, name: "Notifications" })
    .parentElement as HTMLElement;
const settings = () =>
  screen.getByRole("heading", { level: 3, name: "Settings" })
    .parentElement as HTMLElement;
const radio = (name: string) =>
  within(notifications()).getByRole("radio", { name }) as HTMLInputElement;
const mute = () =>
  within(settings()).getByRole("switch", { name: "Mute conversation" });
const star = () =>
  within(settings()).getByRole("switch", { name: "Star (move to Starred)" });

const hold = () => {
  let release: () => void = () => {};
  h.api.conversations.saveSettings.mockImplementationOnce(
    (id: string, patch: object) =>
      new Promise((resolve) => {
        release = () =>
          resolve({
            settings: { ...h.settings[id], ...patch },
            changed: true,
          });
      }),
  );
  return () => release();
};

describe("Notifications (R17)", () => {
  test("three radios in label.opt with one name, in order, with the prototype's texts", async () => {
    await open();
    const labels = [...notifications().querySelectorAll("label.opt")];
    expect(labels.map((l) => l.textContent)).toEqual([
      "All messages",
      "Mentions only",
      "Nothing",
    ]);
    const inputs = labels.map(
      (l) => l.querySelector("input") as HTMLInputElement,
    );
    expect(inputs.every((i) => i.type === "radio")).toBe(true);
    expect(new Set(inputs.map((i) => i.name)).size).toBe(1);
  });

  test("a channel entry at mentions has Mentions only checked, and a DM at all has All messages", async () => {
    await open("c1");
    expect(radio("Mentions only")).toBeChecked();
    expect(radio("All messages")).not.toBeChecked();
    document.body.innerHTML = "";
    await open("d1");
    expect(radio("All messages")).toBeChecked();
  });

  test("#general draws the same three radios", async () => {
    await open("gen");
    expect(within(notifications()).getAllByRole("radio")).toHaveLength(3);
    expect(radio("All messages")).toBeChecked();
  });

  test("choosing Nothing saves once with that key alone, and the radio is checked after the answer, not before", async () => {
    await open("c1");
    const release = hold();
    await userEvent.click(radio("Nothing"));
    expect(h.api.conversations.saveSettings).toHaveBeenCalledTimes(1);
    expect(h.api.conversations.saveSettings).toHaveBeenCalledWith("c1", {
      notificationLevel: "none",
    });
    expect(radio("Mentions only")).toBeChecked();
    expect(radio("Nothing")).not.toBeChecked();
    await act(async () => release());
    expect(radio("Nothing")).toBeChecked();
  });

  test("while it runs only the pressed control is disabled", async () => {
    await open("c1");
    const release = hold();
    await userEvent.click(radio("Nothing"));
    expect(
      within(notifications())
        .getAllByRole("radio")
        .every((r) => (r as HTMLInputElement).disabled),
    ).toBe(true);
    expect(mute()).toBeEnabled();
    expect(star()).toBeEnabled();
    await act(async () => release());
    expect(radio("All messages")).toBeEnabled();
  });

  test("offline: nothing is saved and the radio keeps its value", async () => {
    await open("c1");
    setConnectionCheck(() => false);
    await userEvent.click(radio("Nothing"));
    expect(h.api.conversations.saveSettings).not.toHaveBeenCalled();
    expect(radio("Mentions only")).toBeChecked();
    expect(screen.getByText(/You are offline/)).toBeInTheDocument();
  });

  test("a failure keeps the value and shows one toast", async () => {
    await open("c1");
    h.api.conversations.saveSettings.mockRejectedValueOnce(http(500));
    await userEvent.click(radio("Nothing"));
    expect(radio("Mentions only")).toBeChecked();
    expect(screen.getAllByText("That did not work. Try again.")).toHaveLength(
      1,
    );
  });

  test("a 403 goes to onNoAccess", async () => {
    await open("c1");
    h.api.conversations.saveSettings.mockRejectedValueOnce(http(403));
    await userEvent.click(radio("Nothing"));
    expect(onNoAccess).toHaveBeenCalledTimes(1);
  });
});

describe("Settings (R18)", () => {
  test("both switches show the entry's mute and star", async () => {
    await open("c1");
    expect(mute()).toHaveAttribute("aria-checked", "false");
    expect(star()).toHaveAttribute("aria-checked", "false");
    document.body.innerHTML = "";
    await open("c2");
    expect(mute()).toHaveAttribute("aria-checked", "true");
    expect(star()).toHaveAttribute("aria-checked", "true");
  });

  test("the rows are div.setrow with a span.grow and the switch named by it", async () => {
    await open("c1");
    const rows = [...settings().querySelectorAll("div.setrow")];
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.querySelector("span.grow")).toBeTruthy();
      expect(row.querySelector("button[role=switch]")).toBeTruthy();
    }
  });

  test("a press saves the other value as one key, and the switch changes when the answer arrives", async () => {
    await open("c1");
    const release = hold();
    await userEvent.click(mute());
    expect(h.api.conversations.saveSettings).toHaveBeenCalledWith("c1", {
      isMuted: true,
    });
    expect(mute()).toHaveAttribute("aria-checked", "false");
    expect(mute()).toBeDisabled();
    expect(star()).toBeEnabled();
    await act(async () => release());
    expect(mute()).toHaveAttribute("aria-checked", "true");
    expect(mute()).toBeEnabled();
  });

  test("pressing the star saves isStarred alone and the header shows the star", async () => {
    await open("c1");
    expect(document.querySelector(".mh .later-ic")).toBeNull();
    await userEvent.click(star());
    expect(h.api.conversations.saveSettings).toHaveBeenCalledWith("c1", {
      isStarred: true,
    });
    expect(document.querySelector(".mh .later-ic")).toBeTruthy();
    await userEvent.click(star());
    expect(h.api.conversations.saveSettings).toHaveBeenLastCalledWith("c1", {
      isStarred: false,
    });
    expect(document.querySelector(".mh .later-ic")).toBeNull();
  });

  test("the panel of one conversation never shows the values of another", async () => {
    await open("c1");
    expect(
      within(notifications())
        .getAllByRole("radio")
        .filter((r) => (r as HTMLInputElement).checked),
    ).toHaveLength(1);
    expect(radio("Nothing")).not.toBeChecked();
    expect(mute()).toHaveAttribute("aria-checked", "false");
  });

  test("the same controls are drawn for a DM and for #general", async () => {
    await open("d1");
    expect(within(settings()).getAllByRole("switch")).toHaveLength(2);
    document.body.innerHTML = "";
    await open("gen");
    expect(within(settings()).getAllByRole("switch")).toHaveLength(2);
  });
});
