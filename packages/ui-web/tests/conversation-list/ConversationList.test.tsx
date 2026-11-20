import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, test, vi } from "vitest";
import {
  ConversationList,
  conversationGroupIds,
  type ConversationGroup,
  type ConversationListProps,
  type ConversationRowData,
} from "../../src/conversation-list";

function row(
  id: string,
  extra: Partial<ConversationRowData> = {},
): ConversationRowData {
  return {
    id,
    href: `/c/${id}`,
    kind: "channel",
    name: id,
    ...extra,
  };
}

function group(
  id: ConversationGroup["id"],
  rows: ConversationRowData[],
  extra: Partial<ConversationGroup> = {},
): ConversationGroup {
  return { id, label: `label-${id}`, collapsed: false, rows, ...extra };
}

function props(
  extra: Partial<ConversationListProps> = {},
): ConversationListProps {
  return {
    title: "Conversations",
    search: {
      value: "",
      label: "Search conversations",
      placeholder: "Search conversations",
      onChange: () => {},
    },
    filters: {
      label: "Filter conversations",
      value: "all",
      options: [
        { id: "all", label: "All" },
        { id: "unread", label: "Unread" },
        { id: "mentions", label: "Mentions" },
      ],
      onChange: () => {},
    },
    groups: [group("channels", [row("general")])],
    empty: {
      title: "No conversations match",
      description: "Try another filter.",
      actionLabel: "Clear filter",
      onAction: () => {},
    },
    ...extra,
  };
}

function clist(container: HTMLElement): HTMLElement {
  return container.querySelector("div.clist") as HTMLElement;
}

describe("exports (R1)", () => {
  test("the group ids", () => {
    expect(conversationGroupIds).toEqual(["starred", "channels", "direct"]);
  });
});

describe("structure (R3)", () => {
  test("renders a fragment of div.ch, div.cfilter and div.clist, in this order", () => {
    const { container } = render(<ConversationList {...props()} />);
    expect(
      Array.from(container.children).map(
        (el) => `${el.tagName}.${el.className}`,
      ),
    ).toEqual(["DIV.ch", "DIV.cfilter", "DIV.clist"]);
    const heading = container.querySelector("div.ch > h2");
    expect(heading).toHaveTextContent("Conversations");
  });

  test("with browse and notice: the button in the header, the notice between header and filters", () => {
    const onPress = vi.fn();
    const { container } = render(
      <ConversationList
        {...props({
          browse: { label: "Browse channels", onPress },
          notice: <p data-testid="notice">offline</p>,
        })}
      />,
    );
    expect(
      Array.from(container.children).map((el) => el.className || el.tagName),
    ).toEqual(["ch", "P", "cfilter", "clist"]);
    const button = within(
      container.querySelector("div.ch") as HTMLElement,
    ).getByRole("button", { name: "Browse channels" });
    expect(button).toHaveClass("ib", "sm");
    expect(button.querySelector("svg")).not.toBeNull();
  });

  test("without browse there is no header button and no Browse row", () => {
    const { container } = render(<ConversationList {...props()} />);
    expect(container.querySelector("div.ch button")).toBeNull();
    expect(container.querySelector(".cr.browse")).toBeNull();
  });

  test("ref goes to div.clist; className and attributes pass through", () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(
      <ConversationList
        {...props()}
        ref={ref}
        className="extra"
        aria-busy="true"
        data-x="1"
      />,
    );
    expect(ref.current).toBe(clist(container));
    expect(ref.current).toHaveClass("clist", "extra");
    expect(ref.current).toHaveAttribute("aria-busy", "true");
    expect(ref.current).toHaveAttribute("data-x", "1");
  });
});

describe("groups (R4)", () => {
  const groups = [
    group("starred", []),
    group("channels", [row("a"), row("b")], { collapsed: false }),
    group("direct", [], { keepWhenEmpty: true, label: "Direct" }),
  ];

  test("an empty group is drawn only with keepWhenEmpty; order and rows follow the props", () => {
    const { container } = render(<ConversationList {...props({ groups })} />);
    const drawn = Array.from(container.querySelectorAll(".cgroup")).map((g) =>
      g.getAttribute("data-group"),
    );
    expect(drawn).toEqual(["channels", "direct"]);
    const channels = container.querySelector('[data-group="channels"]')!;
    expect(
      Array.from(channels.querySelectorAll("a.cr")).map((a) =>
        a.getAttribute("href"),
      ),
    ).toEqual(["/c/a", "/c/b"]);
    const direct = container.querySelector('[data-group="direct"]')!;
    expect(direct.querySelector("div.sech")).not.toBeNull();
    expect(direct.querySelector("div.crows")!.children).toHaveLength(0);
    expect(direct.querySelector("div.crows")).toHaveAttribute("id");
  });

  test("the order of the array is the order drawn", () => {
    const { container } = render(
      <ConversationList
        {...props({
          groups: [group("direct", [row("x")]), group("starred", [row("y")])],
        })}
      />,
    );
    expect(
      Array.from(container.querySelectorAll(".cgroup")).map((g) =>
        g.getAttribute("data-group"),
      ),
    ).toEqual(["direct", "starred"]);
  });

  test("the heading is a button.sec with aria-expanded, aria-controls, an icon and the label", () => {
    const { container } = render(<ConversationList {...props({ groups })} />);
    const heading = screen.getByRole("button", { name: "label-channels" });
    expect(heading).toHaveClass("sec");
    expect(heading).not.toHaveClass("fold");
    expect(heading).toHaveAttribute("type", "button");
    expect(heading).toHaveAttribute("aria-expanded", "true");
    const rows = container.querySelector('[data-group="channels"] .crows')!;
    expect(heading).toHaveAttribute("aria-controls", rows.id);
    expect(heading.querySelector("svg.ic")).not.toBeNull();
    expect(heading.querySelector("span")).toHaveTextContent("label-channels");
  });

  test("a collapsed group is hidden, holds no row, and aria-controls points at it", () => {
    const { container } = render(
      <ConversationList
        {...props({
          groups: [group("channels", [row("a")], { collapsed: true })],
        })}
      />,
    );
    const heading = screen.getByRole("button", { name: "label-channels" });
    expect(heading).toHaveClass("fold");
    expect(heading).toHaveAttribute("aria-expanded", "false");
    const rows = container.querySelector(".crows") as HTMLElement;
    expect(rows).toHaveAttribute("hidden");
    expect(rows.id).not.toBe("");
    expect(heading).toHaveAttribute("aria-controls", rows.id);
    expect(container.querySelectorAll("a.cr")).toHaveLength(0);
  });

  test("a press, Enter and Space on the heading call onToggleGroup with the id", async () => {
    const onToggleGroup = vi.fn();
    const user = userEvent.setup();
    render(
      <ConversationList
        {...props({
          groups: [group("starred", [row("a")]), group("channels", [row("b")])],
          onToggleGroup,
        })}
      />,
    );
    await user.click(screen.getByRole("button", { name: "label-channels" }));
    expect(onToggleGroup).toHaveBeenLastCalledWith("channels");
    screen.getByRole("button", { name: "label-starred" }).focus();
    await user.keyboard("{Enter}");
    expect(onToggleGroup).toHaveBeenLastCalledWith("starred");
    await user.keyboard(" ");
    expect(onToggleGroup).toHaveBeenCalledTimes(3);
  });

  test("a collapsed group with unreadCount 7 draws span.sec-count after the label", () => {
    render(
      <ConversationList
        {...props({
          groups: [
            group("channels", [row("a")], {
              collapsed: true,
              unreadCount: 7,
              unreadLabel: "7 unread",
            }),
          ],
        })}
      />,
    );
    const heading = screen.getByRole("button", { name: /label-channels/ });
    const count = heading.querySelector("span.sec-count") as HTMLElement;
    expect(count).not.toBeNull();
    expect(count).toHaveClass("cnt");
    expect(count).toHaveTextContent("7");
    expect(count.textContent).toContain("7 unread");
    expect(heading.lastElementChild).toBe(count);
    expect(count.previousElementSibling).toHaveTextContent("label-channels");
  });

  test("an expanded group, a count of 0, none, NaN or negative draws no span.sec-count", () => {
    const cases: Array<Partial<ConversationGroup>> = [
      { collapsed: false, unreadCount: 7, unreadLabel: "7 unread" },
      { collapsed: true, unreadCount: 0 },
      { collapsed: true },
      { collapsed: true, unreadCount: Number.NaN },
      { collapsed: true, unreadCount: -1 },
    ];
    for (const extra of cases) {
      const { container, unmount } = render(
        <ConversationList
          {...props({ groups: [group("channels", [row("a")], extra)] })}
        />,
      );
      expect(
        container.querySelector(".sec-count"),
        JSON.stringify(extra),
      ).toBeNull();
      unmount();
    }
  });
});

describe("the '+' of a group (R5)", () => {
  test("draws a sec-add IconButton after button.sec and not inside a button; a press calls onPress", async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <ConversationList
        {...props({
          groups: [
            group("direct", [row("a")], {
              action: { label: "New message", onPress },
            }),
          ],
        })}
      />,
    );
    const add = screen.getByRole("button", { name: "New message" });
    expect(add).toHaveClass("ib", "sm", "sec-add");
    expect(add.previousElementSibling).toBe(
      container.querySelector("button.sec"),
    );
    expect(add.closest("button.sec")).toBeNull();
    expect(add.parentElement).toHaveClass("sech");
    await user.click(add);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test("without action no such button is drawn", () => {
    const { container } = render(<ConversationList {...props()} />);
    expect(container.querySelector(".sec-add")).toBeNull();
  });
});

describe("a row (R6)", () => {
  function renderRow(r: ConversationRowData) {
    const { container } = render(
      <ConversationList {...props({ groups: [group("channels", [r])] })} />,
    );
    return container.querySelector("a.cr") as HTMLAnchorElement;
  }

  test("a public channel: a link with HashIcon in span.gl and the name in span.nm", () => {
    const a = renderRow(row("general", { name: "general" }));
    expect(a).toHaveAttribute("href", "/c/general");
    expect(Array.from(a.children).map((c) => c.className)).toEqual([
      "gl",
      "nm",
    ]);
    expect(a.querySelector(".gl svg")).not.toBeNull();
    expect(a.querySelector(".nm")).toHaveTextContent("general");
    expect(a).not.toHaveAttribute("aria-current");
  });

  test("the glyph differs per kind: hash, lock, avatar, users", () => {
    const glyphs = (r: ConversationRowData) => {
      const a = renderRow(r);
      const gl = a.querySelector(".gl") as HTMLElement;
      const html = gl.innerHTML;
      cleanupRender();
      return html;
    };
    const pub = glyphs(row("a"));
    const priv = glyphs(row("a", { isPrivate: true }));
    const group_dm = glyphs(row("a", { kind: "group_dm" }));
    expect(new Set([pub, priv, group_dm]).size).toBe(3);
  });

  test("a private channel has the lock and span.sr with privateLabel", () => {
    const a = renderRow(
      row("p", { isPrivate: true, privateLabel: "Private channel" }),
    );
    expect(a.querySelector("span.sr")).toHaveTextContent("Private channel");
    expect(a.querySelector(".nm")!.nextElementSibling).toHaveClass("sr");
    const publicRow = renderRow(row("q", { privateLabel: "Private channel" }));
    expect(publicRow.querySelector("span.sr")).toBeNull();
  });

  test("a dm draws an Avatar of size 24 with the hue and the optional presence", () => {
    const a = renderRow(
      row("d", {
        kind: "dm",
        avatar: { name: "Alex Pham", hue: 120 },
      }),
    );
    const av = a.querySelector(".gl .av") as HTMLElement;
    expect(av).toHaveTextContent("AP");
    expect(av.style.getPropertyValue("--h")).toBe("120");
    expect(av.style.getPropertyValue("--s")).toBe("24px");
    cleanupRender();
    const withPresence = renderRow(
      row("d", {
        kind: "dm",
        avatar: {
          name: "Alex Pham",
          hue: 120,
          presence: "away",
          presenceLabel: "Online",
        },
      }),
    );
    expect(withPresence.querySelector(".gl .pdw")).not.toBeNull();
    expect(
      within(withPresence).getByRole("img", { name: "Online" }),
    ).toHaveClass("pd", "away");
  });

  test("a deactivated person has a Tag; muted has span.sr and class mutec", () => {
    const a = renderRow(
      row("d", {
        kind: "dm",
        avatar: { name: "A", hue: 1 },
        deactivatedLabel: "Deactivated",
        isMuted: true,
        mutedLabel: "Muted",
      }),
    );
    expect(a.querySelector("span.tag")).toHaveTextContent("Deactivated");
    expect(a.querySelector("span.sr")).toHaveTextContent("Muted");
    expect(a).toHaveClass("mutec");
  });

  test("a starred row has span.star after span.nm with a star and the starred label", () => {
    const a = renderRow(row("s", { isStarred: true, starredLabel: "Starred" }));
    const star = a.querySelector("span.star") as HTMLElement;
    expect(star.querySelector("svg")).not.toBeNull();
    expect(star.querySelector("span.sr")).toHaveTextContent("Starred");
    const children = Array.from(a.children);
    expect(children.indexOf(star)).toBeGreaterThan(
      children.indexOf(a.querySelector(".nm") as HTMLElement),
    );
    cleanupRender();
    expect(renderRow(row("t")).querySelector(".star")).toBeNull();
  });

  test("draftLabel shows in span.draft unless the row is current", () => {
    expect(
      renderRow(row("a", { draftLabel: "Draft" })).querySelector("span.draft"),
    ).toHaveTextContent("Draft");
    cleanupRender();
    expect(
      renderRow(row("a", { draftLabel: "Draft", current: true })).querySelector(
        "span.draft",
      ),
    ).toBeNull();
  });

  test("current sets aria-current=page", () => {
    expect(renderRow(row("a", { current: true }))).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("the mention badge shows @ with the label; the count badge shows the count with its label", () => {
    const a = renderRow(
      row("a", {
        hasMention: true,
        mentionLabel: "Mention",
        unreadCount: 4,
        unreadLabel: "4 unread",
      }),
    );
    const badges = Array.from(a.querySelectorAll("span.cnt"));
    expect(badges).toHaveLength(2);
    expect(badges[0]).toHaveClass("mn");
    expect(badges[0]).toHaveTextContent("@");
    expect(badges[0]!.textContent).toContain("Mention");
    expect(badges[1]).not.toHaveClass("mn");
    expect(badges[1]).toHaveTextContent("4");
    expect(badges[1]!.textContent).toContain("4 unread");
  });
});

function cleanupRender() {
  cleanup();
}

describe("clicks on a row (R6)", () => {
  test("a plain left click calls onOpenRow with the row and the event, and prevents navigation", async () => {
    const onOpenRow = vi.fn();
    const r = row("a");
    render(
      <ConversationList
        {...props({ groups: [group("channels", [r])], onOpenRow })}
      />,
    );
    const link = screen.getByRole("link");
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(onOpenRow).toHaveBeenCalledTimes(1);
    expect(onOpenRow.mock.calls[0]![0]).toEqual(r);
    expect(event.defaultPrevented).toBe(true);
  });

  test.each([["ctrlKey"], ["metaKey"], ["shiftKey"], ["altKey"]])(
    "a click with %s is left to the browser",
    (key) => {
      const onOpenRow = vi.fn();
      render(
        <ConversationList
          {...props({ groups: [group("channels", [row("a")])], onOpenRow })}
        />,
      );
      const event = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        [key]: true,
      });
      screen.getByRole("link").dispatchEvent(event);
      expect(onOpenRow).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    },
  );

  test("a middle click is left to the browser", () => {
    const onOpenRow = vi.fn();
    render(
      <ConversationList
        {...props({ groups: [group("channels", [row("a")])], onOpenRow })}
      />,
    );
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 1,
    });
    screen.getByRole("link").dispatchEvent(event);
    expect(onOpenRow).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  test("without onOpenRow a click is left to the browser", () => {
    render(
      <ConversationList
        {...props({ groups: [group("channels", [row("a")])] })}
      />,
    );
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    screen.getByRole("link").dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe("the look of a row (R7)", () => {
  function look(extra: Partial<ConversationRowData>) {
    const { container, unmount } = render(
      <ConversationList
        {...props({
          groups: [
            group("channels", [
              row("a", { unreadLabel: "n", mentionLabel: "m", ...extra }),
            ]),
          ],
        })}
      />,
    );
    const a = container.querySelector("a.cr")!;
    const out = {
      un: a.classList.contains("un"),
      mutec: a.classList.contains("mutec"),
      count: a.querySelector("span.cnt:not(.mn)")?.textContent ?? null,
      mention: a.querySelector("span.cnt.mn") !== null,
    };
    unmount();
    return out;
  }

  test.each([
    [false, false, false],
    [false, false, true],
    [false, true, false],
    [false, true, true],
    [true, false, false],
    [true, false, true],
    [true, true, false],
    [true, true, true],
  ])("unread %s, muted %s, mention %s", (unread, muted, mention) => {
    const out = look({
      unreadCount: unread ? 3 : 0,
      isMuted: muted,
      hasMention: mention,
    });
    expect(out.un).toBe(unread && !muted);
    expect(out.mutec).toBe(muted);
    expect(out.count !== null).toBe(unread && !muted);
    expect(out.mention).toBe(mention);
  });

  test.each([
    [0, false],
    [-1, false],
    [Number.NaN, false],
    [undefined, false],
    [1, true],
    [100, true],
  ])("a count of %s draws a count: %s, with no cap", (count, drawn) => {
    const out = look({ unreadCount: count });
    expect(out.un).toBe(drawn);
    expect(out.count !== null).toBe(drawn);
    if (drawn) expect(out.count).toContain(String(count));
  });
});

describe("the Browse channels row (R8)", () => {
  test("is the last child of div.clist, after the groups and the empty state, and a press calls onPress", async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <ConversationList
        {...props({
          groups: [],
          browse: { label: "Browse channels", onPress },
        })}
      />,
    );
    const list = clist(container);
    const last = list.lastElementChild as HTMLElement;
    expect(last.tagName).toBe("BUTTON");
    expect(last).toHaveClass("cr", "browse");
    expect(last).toHaveAttribute("type", "button");
    expect(last.querySelector(".gl svg")).not.toBeNull();
    expect(last.querySelector(".nm")).toHaveTextContent("Browse channels");
    expect(last.previousElementSibling).toHaveClass("empty");
    await user.click(last);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe("the search field (R9)", () => {
  function Controlled({ onChange }: { onChange: (v: string) => void }) {
    const [value, setValue] = useState("");
    return (
      <ConversationList
        {...props({
          search: {
            value,
            label: "Search conversations",
            placeholder: "Find",
            onChange: (v) => {
              setValue(v);
              onChange(v);
            },
          },
        })}
      />
    );
  }

  test("is a search Field with one icon, the name, the placeholder and the value", () => {
    const { container } = render(<ConversationList {...props()} />);
    const input = screen.getByRole("searchbox", {
      name: "Search conversations",
    });
    expect(input).toHaveAttribute("type", "search");
    expect(input).toHaveAttribute("placeholder", "Search conversations");
    const label = input.closest("label.field") as HTMLElement;
    expect(label.querySelectorAll("svg")).toHaveLength(1);
    expect(container.querySelector(".cfilter")!.contains(label)).toBe(true);
  });

  test("typing three characters calls onChange three times with the growing text", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Controlled onChange={onChange} />);
    await user.type(screen.getByRole("searchbox"), "ngo");
    expect(onChange.mock.calls.map((c) => c[0])).toEqual(["n", "ng", "ngo"]);
  });
});

describe("the filter chips (R10)", () => {
  test.each(["all", "unread", "mentions"])(
    "the chip %s is pressed and the others are not",
    (value) => {
      render(
        <ConversationList
          {...props({
            filters: { ...props().filters, value },
          })}
        />,
      );
      const group = screen.getByRole("group", { name: "Filter conversations" });
      const chips = within(group).getAllByRole("button");
      expect(chips.map((c) => c.textContent)).toEqual([
        "All",
        "Unread",
        "Mentions",
      ]);
      for (const chip of chips) {
        expect(chip).toHaveClass("chip", "sm");
        expect(chip).toHaveAttribute(
          "aria-pressed",
          String(chip.textContent!.toLowerCase() === value),
        );
      }
    },
  );

  test("a press calls onChange with the id", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ConversationList
        {...props({ filters: { ...props().filters, onChange } })}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Mentions" }));
    expect(onChange).toHaveBeenCalledWith("mentions");
  });
});

describe("the empty state (R11)", () => {
  test("is drawn when no group holds a row, with the button; not drawn otherwise", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    const { container, rerender } = render(
      <ConversationList
        {...props({
          groups: [group("channels", [])],
          empty: { ...props().empty, onAction },
        })}
      />,
    );
    const empty = container.querySelector("div.clist > .empty") as HTMLElement;
    expect(empty).not.toBeNull();
    expect(empty).toHaveTextContent("No conversations match");
    expect(empty).toHaveTextContent("Try another filter.");
    await user.click(screen.getByRole("button", { name: "Clear filter" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Clear filter" })).toHaveClass(
      "btn",
      "sm",
    );

    rerender(<ConversationList {...props()} />);
    expect(container.querySelector(".empty")).toBeNull();
  });

  test("rows that a collapsed group holds are rows: no empty state", () => {
    const { container } = render(
      <ConversationList
        {...props({
          groups: [group("channels", [row("a")], { collapsed: true })],
        })}
      />,
    );
    expect(container.querySelector(".empty")).toBeNull();
  });
});

describe("no text of its own (R2)", () => {
  const empty = "";
  const allEmpty = (extra: Partial<ConversationRowData> = {}) =>
    props({
      title: empty,
      search: {
        value: "",
        label: empty,
        placeholder: empty,
        onChange: () => {},
      },
      filters: {
        label: empty,
        value: "all",
        options: [
          { id: "all", label: empty },
          { id: "unread", label: empty },
        ],
        onChange: () => {},
      },
      browse: { label: empty, onPress: () => {} },
      empty: {
        title: empty,
        description: empty,
        actionLabel: empty,
        onAction: () => {},
      },
      groups: [
        group(
          "starred",
          [
            row("a", {
              name: empty,
              isPrivate: true,
              isStarred: true,
              privateLabel: empty,
              starredLabel: empty,
              isMuted: true,
              mutedLabel: empty,
              deactivatedLabel: undefined,
              ...extra,
            }),
            row("b", {
              kind: "dm",
              name: empty,
              avatar: {
                name: empty,
                hue: 3,
                presence: "away",
                presenceLabel: empty,
              },
            }),
            row("c", { kind: "group_dm", name: empty }),
          ],
          {
            label: empty,
            action: { label: empty, onPress: () => {} },
          },
        ),
        group("channels", [row("d", { name: empty })], {
          label: empty,
          collapsed: true,
          unreadCount: 5,
          unreadLabel: empty,
        }),
      ],
    });

  test("every text prop empty and no count and no mention: textContent is empty", () => {
    const { container } = render(
      <ConversationList
        {...allEmpty()}
        groups={allEmpty().groups.map((g) => ({
          ...g,
          unreadCount: undefined,
        }))}
      />,
    );
    expect(container.textContent).toBe("");
  });

  test("with a count and a mention: only digits and the @ mark", () => {
    const { container } = render(
      <ConversationList
        {...allEmpty({
          isMuted: false,
          unreadCount: 12,
          hasMention: true,
          mentionLabel: empty,
          unreadLabel: empty,
        })}
      />,
    );
    expect(container.textContent).toMatch(/^[0-9@]+$/);
    expect(container.textContent).toContain("@");
    expect(container.textContent).toContain("12");
    expect(container.textContent).toContain("5");
  });
});
