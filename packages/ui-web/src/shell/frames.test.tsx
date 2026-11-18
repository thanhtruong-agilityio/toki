import { createRef, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SectionPage, SidePanel, Tab, TabList } from "./index";

afterEach(() => {
  Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});

const labels = { back: "Back", close: "Close" };

describe("SidePanel (R11)", () => {
  test("a header with back, title, subtitle and close, then the body", () => {
    const { container } = render(
      <SidePanel
        title="Thread"
        subtitle="in general"
        labels={labels}
        onClose={() => {}}
      >
        <p>body</p>
      </SidePanel>,
    );
    const sh = container.querySelector("div.sh")!;
    expect([...sh.children].map((c) => c.tagName)).toEqual([
      "BUTTON",
      "H2",
      "BUTTON",
    ]);
    const back = sh.querySelector("button.ib.back-side")!;
    const close = sh.querySelector("button.ib.sm.closex")!;
    expect(back).toHaveAccessibleName("Back");
    expect(close).toHaveAccessibleName("Close");
    const h2 = sh.querySelector("h2")!;
    expect(h2).toHaveClass("ell");
    expect(h2.firstChild).toHaveTextContent("Thread");
    expect(h2.querySelector("span.muted")).toHaveTextContent("in general");
    expect(container.querySelector("div.sb")).toHaveTextContent("body");
    expect(container.querySelector("div.sh + div.sb")).not.toBeNull();
  });

  test("no subtitle, no span", () => {
    const { container } = render(
      <SidePanel title="T" labels={labels} onClose={() => {}} />,
    );
    expect(container.querySelector("h2 .muted")).toBeNull();
  });

  test("both buttons call onClose", async () => {
    const onClose = vi.fn();
    render(<SidePanel title="T" labels={labels} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  test("empty strings give no text", () => {
    const { container } = render(
      <SidePanel
        title=""
        labels={{ back: "", close: "" }}
        onClose={() => {}}
      />,
    );
    expect(container.textContent).toBe("");
  });

  test("Escape closes it", async () => {
    const onClose = vi.fn();
    render(<SidePanel title="T" labels={labels} onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("other keys and a composing Escape do not", () => {
    const onClose = vi.fn();
    render(<SidePanel title="T" labels={labels} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Enter" });
    fireEvent.keyDown(document, { key: "Escape", isComposing: true });
    expect(onClose).not.toHaveBeenCalled();
  });

  test("an Escape that a layer stopped does not close it, the next one does", () => {
    const onClose = vi.fn();
    function Page() {
      const [layer, setLayer] = useState(true);
      return (
        <>
          <SidePanel title="T" labels={labels} onClose={onClose} />
          {layer && (
            <div
              data-testid="layer"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                event.preventDefault();
                event.stopPropagation();
                setLayer(false);
              }}
            />
          )}
        </>
      );
    }
    render(<Page />);
    const layer = screen.getByTestId("layer");
    layer.focus();
    fireEvent.keyDown(layer, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("a stand-in that only prevents the default on the document also wins", () => {
    const onClose = vi.fn();
    const first = (e: KeyboardEvent) => e.preventDefault();
    // Registered before the panel mounts, so it runs first on the document.
    document.addEventListener("keydown", first);
    render(<SidePanel title="T" labels={labels} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    document.removeEventListener("keydown", first);
    expect(onClose).not.toHaveBeenCalled();
  });

  test("it stops listening when it unmounts", () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <SidePanel title="T" labels={labels} onClose={onClose} />,
    );
    unmount();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  test("it uses the latest onClose", () => {
    const a = vi.fn();
    const b = vi.fn();
    const { rerender } = render(
      <SidePanel title="T" labels={labels} onClose={a} />,
    );
    rerender(<SidePanel title="T" labels={labels} onClose={b} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });
});

describe("SectionPage (R12, R34)", () => {
  test("div.sechead with h1.title and actions, then div.secbody", () => {
    const { container } = render(
      <SectionPage title="Files" actions={<button>Add</button>}>
        <p>rows</p>
      </SectionPage>,
    );
    const head = container.querySelector("div.sechead")!;
    expect([...head.children].map((c) => c.tagName)).toEqual(["H1", "BUTTON"]);
    expect(head.querySelector("h1")).toHaveClass("title");
    expect(head.querySelector("h1")).toHaveTextContent("Files");
    expect(head.nextElementSibling).toHaveClass("secbody");
    expect(head.nextElementSibling).toHaveTextContent("rows");
  });

  test("no actions, no node; empty title gives no text", () => {
    const { container } = render(<SectionPage title="" />);
    expect(container.querySelector(".sechead")!.children).toHaveLength(1);
    expect(container.textContent).toBe("");
  });

  test("ref goes to div.sechead and className and attributes pass through", () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(
      <SectionPage ref={ref} className="x" title="T" data-testid="s" />,
    );
    expect(ref.current).toBe(container.querySelector("div.sechead"));
    expect(ref.current).toHaveClass("sechead", "x");
    expect(screen.getByTestId("s")).toBe(ref.current);
  });
});

function Tabs({
  onSelect = () => {},
  selected = "b",
}: {
  onSelect?: (id: string) => void;
  selected?: string;
}) {
  return (
    <>
      <TabList aria-label="Views" data-testid="list">
        {["a", "b", "c"].map((id) => (
          <Tab
            key={id}
            id={`tab-${id}`}
            selected={selected === id}
            panelId={id === "c" ? undefined : `panel-${id}`}
            onSelect={() => onSelect(id)}
          >
            {id.toUpperCase()}
          </Tab>
        ))}
      </TabList>
      <button>after</button>
    </>
  );
}

describe("TabList and Tab (R13, R34)", () => {
  test("roles, names, selection and the roving tab stop", () => {
    const { container } = render(<Tabs />);
    const list = screen.getByRole("tablist", { name: "Views" });
    expect(list).toBe(container.querySelector("div.tabs"));
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.tagName)).toEqual(["BUTTON", "BUTTON", "BUTTON"]);
    for (const t of tabs) expect(t).toHaveClass("tab");
    expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual([
      "false",
      "true",
      "false",
    ]);
    expect(tabs.map((t) => t.getAttribute("tabindex"))).toEqual([
      "-1",
      "0",
      "-1",
    ]);
    expect(tabs.map((t) => t.id)).toEqual(["tab-a", "tab-b", "tab-c"]);
    expect(tabs.map((t) => t.getAttribute("aria-controls"))).toEqual([
      "panel-a",
      "panel-b",
      null,
    ]);
    expect(tabs[0]).toHaveAttribute("type", "button");
  });

  test("a click calls onSelect", async () => {
    const onSelect = vi.fn();
    render(<Tabs onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("tab", { name: "C" }));
    expect(onSelect).toHaveBeenCalledWith("c");
  });

  test("children are the tab's content and it adds no text", () => {
    const { container } = render(
      <TabList aria-label="">
        <Tab id="x" selected onSelect={() => {}} />
      </TabList>,
    );
    expect(container.textContent).toBe("");
  });

  test("ref and className", () => {
    const listRef = createRef<HTMLDivElement>();
    const tabRef = createRef<HTMLButtonElement>();
    render(
      <TabList ref={listRef} className="x" aria-label="V">
        <Tab ref={tabRef} className="y" id="t" selected onSelect={() => {}}>
          T
        </Tab>
      </TabList>,
    );
    expect(listRef.current).toBe(screen.getByRole("tablist"));
    expect(listRef.current).toHaveClass("tabs", "x");
    expect(tabRef.current).toBe(screen.getByRole("tab"));
    expect(tabRef.current).toHaveClass("tab", "y");
  });

  test("the owned attributes win over the spread", () => {
    render(
      <TabList aria-label="V">
        <Tab
          id="t"
          selected
          onSelect={() => {}}
          {...({ role: "button", type: "submit", tabIndex: 5 } as object)}
        >
          T
        </Tab>
      </TabList>,
    );
    const tab = screen.getByRole("tab");
    expect(tab).toHaveAttribute("type", "button");
    expect(tab).toHaveAttribute("tabindex", "0");
  });
});

describe("keyboard in a TabList (R14)", () => {
  const user = userEvent.setup();

  test("ArrowRight and ArrowLeft move focus without selecting, and wrap", async () => {
    const onSelect = vi.fn();
    render(<Tabs onSelect={onSelect} />);
    const [a, b, c] = screen.getAllByRole("tab");
    b!.focus();
    await user.keyboard("{ArrowRight}");
    expect(c).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(a).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(c).toHaveFocus();
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(a).toHaveFocus();
    expect(onSelect).not.toHaveBeenCalled();
  });

  test("Home and End", async () => {
    render(<Tabs />);
    const [a, b, c] = screen.getAllByRole("tab");
    b!.focus();
    await user.keyboard("{End}");
    expect(c).toHaveFocus();
    await user.keyboard("{Home}");
    expect(a).toHaveFocus();
  });

  test("Enter and Space select the focused tab", async () => {
    const onSelect = vi.fn();
    render(<Tabs onSelect={onSelect} />);
    const [a, , c] = screen.getAllByRole("tab");
    a!.focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenLastCalledWith("a");
    c!.focus();
    await user.keyboard(" ");
    expect(onSelect).toHaveBeenLastCalledWith("c");
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  test("other keys do nothing", async () => {
    const onSelect = vi.fn();
    render(<Tabs onSelect={onSelect} />);
    const [, b] = screen.getAllByRole("tab");
    b!.focus();
    await user.keyboard("x{ArrowDown}{ArrowUp}{PageDown}{Escape}");
    expect(b).toHaveFocus();
    expect(onSelect).not.toHaveBeenCalled();
  });

  test("an arrow with Ctrl, Meta or Alt is left to the browser", () => {
    render(<Tabs />);
    const [, b] = screen.getAllByRole("tab");
    b!.focus();
    for (const mod of ["ctrlKey", "metaKey", "altKey"]) {
      const ok = fireEvent.keyDown(b!, { key: "ArrowRight", [mod]: true });
      expect(ok, mod).toBe(true);
      expect(b).toHaveFocus();
    }
  });

  test("Tab leaves the row: only the selected tab is in the Tab order", async () => {
    render(<Tabs />);
    await user.tab();
    expect(screen.getByRole("tab", { name: "B" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "after" })).toHaveFocus();
  });

  test("a moved focus scrolls the tab into view", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(<Tabs />);
    scrollIntoView.mockClear();
    screen.getByRole("tab", { name: "B" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(scrollIntoView).toHaveBeenCalledWith({
      inline: "nearest",
      block: "nearest",
    });
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(
      screen.getByRole("tab", { name: "C" }),
    );
  });

  test("a change of the selected tab scrolls it into view", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { rerender } = render(<Tabs selected="a" />);
    scrollIntoView.mockClear();
    rerender(<Tabs selected="c" />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(
      screen.getByRole("tab", { name: "C" }),
    );
  });

  test("a browser without scrollIntoView is fine", async () => {
    render(<Tabs />);
    screen.getByRole("tab", { name: "B" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "C" })).toHaveFocus();
  });
});
