// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { BrowseRow } from "../../../src/features/channels/BrowseRow";
import { Providers } from "../../support/providers";

const base = {
  id: "c1",
  name: "design",
  topic: "Pixels and type",
  isPrivate: false,
  isGeneral: false,
  archived: false,
  memberCount: 25,
  isMember: false,
};

function row(
  over: Record<string, unknown> = {},
  props: Record<string, unknown> = {},
) {
  const onOpen = vi.fn();
  const onJoin = vi.fn();
  const view = render(
    <Providers>
      <ul>
        <BrowseRow
          channel={{ ...base, ...over } as never}
          onOpen={onOpen}
          onJoin={onJoin}
          joinDisabled={false}
          joining={false}
          {...props}
        />
      </ul>
    </Providers>,
  );
  return { ...view, onOpen, onJoin, li: view.container.querySelector("li")! };
}

describe("BrowseRow (TOKI-034 R6, R7)", () => {
  test("a public channel not joined: hash icon, name, topic and count, a primary Join", async () => {
    const user = userEvent.setup();
    const { li, onJoin } = row();
    expect(li.className).toContain("prow");
    expect(li.querySelector(".gl svg")).not.toBeNull();
    expect(li.querySelector(".grow b")!.textContent).toBe("design");
    expect(li.querySelector(".grow .sub")!.textContent).toBe(
      "Pixels and type · 25 members",
    );
    const join = screen.getByRole("button", { name: "Join" });
    expect(join.className).toContain("primary");
    await user.click(join);
    expect(onJoin).toHaveBeenCalledTimes(1);
    expect(li.title).toBe("");
  });

  test("the count of one is singular, and a null topic leaves only the count", () => {
    const { li } = row({ memberCount: 1, topic: null });
    expect(li.querySelector(".sub")!.textContent).toBe("1 member");
  });

  test("a private channel says so first", () => {
    const { li } = row({ isPrivate: true, isMember: true });
    expect(li.querySelector(".sub")!.textContent).toBe(
      "Private · Pixels and type · 25 members",
    );
  });

  test("a member sees Open, which calls onOpen", async () => {
    const user = userEvent.setup();
    const { onOpen } = row({ isMember: true });
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Join" })).toBeNull();
  });

  test("an archived channel carries the label; a non-member gets no button, a member gets Open", () => {
    const first = row({ archived: true });
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    first.unmount();
    row({ archived: true, isMember: true });
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
  });

  test("while a join runs, every Join is disabled and the pressed one is busy", () => {
    row({}, { joinDisabled: true, joining: true });
    const join = screen.getByRole("button", { name: "Join" });
    expect(join).toBeDisabled();
    expect(join).toHaveAttribute("aria-busy", "true");
  });

  test("extra is drawn after the row's own button, and not at all when absent", () => {
    const { li, unmount } = row(
      {},
      { extra: <button type="button">Restore</button> },
    );
    const buttons = Array.from(li.querySelectorAll("button")).map(
      (b) => b.textContent,
    );
    expect(buttons).toEqual(["Join", "Restore"]);
    unmount();
    const { li: plain } = row();
    expect(plain.querySelectorAll("button")).toHaveLength(1);
  });
});
