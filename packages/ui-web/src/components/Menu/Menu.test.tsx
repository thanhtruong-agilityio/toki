import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resolve } from "node:path";
import {
  createRef,
  StrictMode,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { layerCount } from "../../internal/overlays/stack";
import { expectCssTable } from "../../test/css-table";
import { Button } from "../Button/Button";
import { IconButton } from "../IconButton/IconButton";
import { Modal } from "../Modal/Modal";
import {
  Menu,
  menuAligns,
  menuCloseReasons,
  type MenuCloseReason,
} from "./Menu";
import { MenuGroup, MenuSeparator } from "./MenuGroup";
import { MenuItem, menuItemVariants } from "./MenuItem";
import { useMenuTrigger } from "./useMenuTrigger";

const noop = () => {};

afterEach(() => {
  vi.restoreAllMocks();
  document.body.style.overflow = "";
});

function menu(): HTMLElement {
  return screen.getByRole("menu");
}
const item = (name: string) => screen.getByRole("menuitem", { name });
const focused = () => document.activeElement as HTMLElement;

// A trigger and its Menu, as a screen builds them (R24).
function Demo({
  children,
  reasons,
  align,
  ignoreClose,
}: {
  children?: ReactNode;
  reasons?: MenuCloseReason[];
  align?: "end" | "start";
  ignoreClose?: boolean;
}) {
  const t = useMenuTrigger<HTMLButtonElement>();
  return (
    <>
      <button {...t.triggerProps}>trigger</button>
      <button>after</button>
      <Menu
        {...t.menuProps}
        align={align}
        aria-label="Actions"
        onClose={(reason) => {
          reasons?.push(reason);
          if (!ignoreClose) t.menuProps.onClose();
        }}
      >
        {children ?? (
          <>
            <MenuItem>One</MenuItem>
            <MenuItem>Two</MenuItem>
            <MenuItem>Three</MenuItem>
          </>
        )}
      </Menu>
    </>
  );
}

describe("Menu DOM (R17, R18, R19)", () => {
  test("one div.menu in body with its role, data-menu and orientation", () => {
    const anchor = createRef<HTMLButtonElement>();
    render(
      <>
        <button ref={anchor}>a</button>
        <Menu open anchorRef={anchor} onClose={noop} aria-label="Actions">
          <MenuItem>One</MenuItem>
        </Menu>
      </>,
    );
    const el = menu();
    expect(el.parentElement).toBe(document.body);
    expect(document.body.lastElementChild).toBe(el);
    expect(el.className).toBe("menu");
    expect(el).toHaveAttribute("data-menu");
    expect(el).toHaveAttribute("aria-orientation", "vertical");
    expect(el).toHaveAttribute("aria-label", "Actions");
    expect(screen.getByRole("menu", { name: "Actions" })).toBe(el);
    expect(el.children).toHaveLength(1);
  });

  test("named by aria-labelledby; owned attributes win; ref and className", () => {
    const anchor = createRef<HTMLButtonElement>();
    const ref = createRef<HTMLDivElement>();
    const hostile = {
      role: "list",
      "aria-orientation": "horizontal",
    } as object;
    render(
      <>
        <span id="n">Named</span>
        <button ref={anchor}>a</button>
        <Menu
          ref={ref}
          open
          anchorRef={anchor}
          onClose={noop}
          aria-labelledby="n"
          className="mine"
          data-x="1"
          {...hostile}
        />
      </>,
    );
    expect(ref.current).toBe(menu());
    expect(menu().className).toBe("menu mine");
    expect(menu()).toHaveAttribute("role", "menu");
    expect(menu()).toHaveAttribute("aria-orientation", "vertical");
    expect(menu()).toHaveAttribute("data-x", "1");
    expect(screen.getByRole("menu", { name: "Named" })).toBe(menu());
  });

  test("MenuItem: a button with type, role, tabindex, an optional Icon and a span", () => {
    const anchor = createRef<HTMLButtonElement>();
    const ref = createRef<HTMLButtonElement>();
    const hostile = { type: "submit", role: "button", tabIndex: 0 } as object;
    render(
      <>
        <button ref={anchor}>a</button>
        <Menu open anchorRef={anchor} onClose={noop} aria-label="m">
          <MenuItem ref={ref} icon="edit" className="mine" {...hostile}>
            Edit
          </MenuItem>
          <MenuItem variant="danger">Delete</MenuItem>
          <MenuItem disabled>Locked</MenuItem>
        </Menu>
      </>,
    );
    const edit = item("Edit");
    expect(ref.current).toBe(edit);
    expect(edit.tagName).toBe("BUTTON");
    expect(edit).toHaveAttribute("type", "button");
    expect(edit).toHaveAttribute("role", "menuitem");
    expect(edit).toHaveAttribute("tabindex", "-1");
    expect(edit.className).toBe("mine");
    expect(edit.children).toHaveLength(2);
    expect(edit.children[0]!.tagName.toLowerCase()).toBe("svg");
    expect(edit.children[1]!.tagName).toBe("SPAN");
    expect(edit.children[1]).toHaveTextContent("Edit");
    const del = item("Delete");
    expect(del.className).toBe("dng");
    expect(del.children).toHaveLength(1);
    const locked = item("Locked");
    expect(locked).toHaveAttribute("aria-disabled", "true");
    expect(locked).not.toHaveAttribute("disabled");
    expect(item("Delete")).not.toHaveAttribute("aria-disabled");
    expect(menuItemVariants).toEqual(["default", "danger"]);
    expect(menuAligns).toEqual(["end", "start"]);
    expect(menuCloseReasons).toEqual(["select", "escape", "tab", "outside"]);
  });

  test("MenuGroup names itself by its heading; MenuSeparator is an hr", () => {
    const anchor = createRef<HTMLButtonElement>();
    const gref = createRef<HTMLDivElement>();
    const sref = createRef<HTMLHRElement>();
    render(
      <>
        <button ref={anchor}>a</button>
        <Menu open anchorRef={anchor} onClose={noop} aria-label="m">
          <MenuGroup ref={gref} label="Status" className="g">
            <MenuItem>Away</MenuItem>
          </MenuGroup>
          <MenuSeparator ref={sref} />
        </Menu>
      </>,
    );
    const group = screen.getByRole("group", { name: "Status" });
    expect(gref.current).toBe(group);
    expect(group.className).toBe("g");
    const heading = group.firstElementChild as HTMLElement;
    expect(heading.className).toBe("mt");
    expect(heading).toHaveTextContent("Status");
    expect(group).toHaveAttribute("aria-labelledby", heading.id);
    expect(sref.current?.tagName).toBe("HR");
    expect(screen.getByRole("separator")).toBe(sref.current);
  });

  test("with every text empty the text is empty", () => {
    const anchor = createRef<HTMLButtonElement>();
    render(
      <>
        <button ref={anchor} />
        <Menu open anchorRef={anchor} onClose={noop} aria-label="">
          <MenuGroup label="">
            <MenuItem icon="edit">{""}</MenuItem>
          </MenuGroup>
          <MenuSeparator />
        </Menu>
      </>,
    );
    expect(menu().textContent).toBe("");
  });
});

describe("nothing is left when closed (R4)", () => {
  test("closed, and open then unmounted, leave nothing behind", () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const winAdd = vi.spyOn(window, "addEventListener");
    const winRemove = vi.spyOn(window, "removeEventListener");
    const anchor = createRef<HTMLButtonElement>();
    const { rerender, unmount } = render(
      <>
        <button ref={anchor} />
        <Menu open={false} anchorRef={anchor} onClose={noop} aria-label="m" />
      </>,
    );
    expect(screen.queryByRole("menu")).toBeNull();
    expect(layerCount()).toBe(0);
    rerender(
      <>
        <button ref={anchor} />
        <Menu open anchorRef={anchor} onClose={noop} aria-label="m" />
      </>,
    );
    expect(layerCount()).toBe(1);
    unmount();
    expect(layerCount()).toBe(0);
    expect(document.querySelector("[data-menu]")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    for (const type of ["keydown", "pointerdown"]) {
      const added = add.mock.calls.filter((c) => c[0] === type).length;
      const removed = remove.mock.calls.filter((c) => c[0] === type).length;
      expect(added, type).toBeGreaterThan(0);
      expect(removed, type).toBe(added);
    }
    for (const type of ["resize", "scroll"]) {
      const added = winAdd.mock.calls.filter((c) => c[0] === type).length;
      const removed = winRemove.mock.calls.filter((c) => c[0] === type).length;
      expect(added, type).toBeGreaterThan(0);
      expect(removed, type).toBe(added);
    }
  });
});

describe("a press inside the menu (R20)", () => {
  test("a press on a heading or the padding keeps focus on the item, and arrows still move", async () => {
    const user = userEvent.setup();
    render(
      <Demo>
        <MenuGroup label="Group">
          <MenuItem>One</MenuItem>
          <MenuItem>Two</MenuItem>
        </MenuGroup>
      </Demo>,
    );
    await user.click(screen.getByText("trigger"));
    expect(focused()).toBe(item("One"));
    const heading = screen.getByText("Group");
    for (const target of [heading, menu()]) {
      const down = new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
      });
      target.dispatchEvent(down);
      expect(down.defaultPrevented).toBe(true);
    }
    await user.pointer({ keys: "[MouseLeft>]", target: heading });
    await user.pointer({ keys: "[/MouseLeft]", target: heading });
    expect(focused()).toBe(item("One"));
    await user.keyboard("{ArrowDown}");
    expect(focused()).toBe(item("Two"));
  });

  test("a press on an item is not prevented", () => {
    render(<Demo />);
    fireEvent.click(screen.getByText("trigger"));
    const down = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
    });
    item("Two").dispatchEvent(down);
    expect(down.defaultPrevented).toBe(false);
  });
});

describe("keys (R20)", () => {
  test("opens on the first item that is not disabled; the last with ArrowUp on the trigger", async () => {
    const user = userEvent.setup();
    render(
      <Demo>
        <MenuItem disabled>Locked</MenuItem>
        <MenuItem>Two</MenuItem>
        <MenuItem>Three</MenuItem>
        <MenuItem disabled>Locked too</MenuItem>
      </Demo>,
    );
    await user.click(screen.getByText("trigger"));
    expect(focused()).toBe(item("Two"));
    await user.keyboard("{Escape}");
    act(() => screen.getByText("trigger").focus());
    await user.keyboard("{ArrowUp}");
    expect(focused()).toBe(item("Three"));
  });

  test("openFocus last picks the last item that is not disabled; all disabled picks the first", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <Demo>
        <MenuItem>One</MenuItem>
        <MenuItem>Two</MenuItem>
        <MenuItem disabled>Locked</MenuItem>
      </Demo>,
    );
    act(() => screen.getByText("trigger").focus());
    await user.keyboard("{ArrowUp}");
    expect(focused()).toBe(item("Two"));
    unmount();
    render(
      <Demo>
        <MenuItem disabled>A</MenuItem>
        <MenuItem disabled>B</MenuItem>
      </Demo>,
    );
    await user.click(screen.getByText("trigger"));
    expect(focused()).toBe(item("A"));
  });

  test("arrows wrap; Home and End; disabled items are visited; groups are walked in order; other keys do nothing", async () => {
    const user = userEvent.setup();
    render(
      <Demo>
        <MenuGroup label="G">
          <MenuItem>One</MenuItem>
          <MenuItem disabled>Two</MenuItem>
        </MenuGroup>
        <MenuSeparator />
        <MenuItem>Three</MenuItem>
      </Demo>,
    );
    await user.click(screen.getByText("trigger"));
    expect(focused()).toBe(item("One"));
    await user.keyboard("{ArrowDown}");
    expect(focused()).toBe(item("Two"));
    await user.keyboard("{ArrowDown}");
    expect(focused()).toBe(item("Three"));
    await user.keyboard("{ArrowDown}");
    expect(focused()).toBe(item("One"));
    await user.keyboard("{ArrowUp}");
    expect(focused()).toBe(item("Three"));
    await user.keyboard("{Home}");
    expect(focused()).toBe(item("One"));
    await user.keyboard("{End}");
    expect(focused()).toBe(item("Three"));
    await user.keyboard("a");
    expect(focused()).toBe(item("Three"));
    expect(menu()).toBeInTheDocument();
  });

  test("Enter and Space press the focused item", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Demo>
        <MenuItem onClick={onClick}>One</MenuItem>
      </Demo>,
    );
    await user.click(screen.getByText("trigger"));
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
    await user.click(screen.getByText("trigger"));
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});

describe("choosing (R21)", () => {
  test("onClick first with focus on the item; then focus to the anchor and onClose(select)", async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    const reasons: MenuCloseReason[] = [];
    render(
      <Demo reasons={reasons}>
        <MenuItem onClick={() => order.push(`click:${focused().textContent}`)}>
          One
        </MenuItem>
      </Demo>,
    );
    const trigger = screen.getByText("trigger");
    await user.click(trigger);
    await user.click(item("One"));
    expect(order).toEqual(["click:One"]);
    expect(reasons).toEqual(["select"]);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(focused()).toBe(trigger);
  });

  test("focus is on the anchor in the same event, before React renders what the handler asked for", async () => {
    const user = userEvent.setup();
    let activeAtClose: Element | null = null;
    function Chooser() {
      const t = useMenuTrigger<HTMLButtonElement>();
      return (
        <>
          <button {...t.triggerProps}>trigger</button>
          <Menu
            {...t.menuProps}
            aria-label="m"
            onClose={(reason) => {
              activeAtClose = document.activeElement;
              t.menuProps.onClose(reason);
            }}
          >
            <MenuItem>One</MenuItem>
          </Menu>
        </>
      );
    }
    render(<Chooser />);
    await user.click(screen.getByText("trigger"));
    await user.click(item("One"));
    expect(activeAtClose).toBe(screen.getByText("trigger"));
  });

  test("a handler that calls preventDefault keeps the menu open and focus on the item; arrows still work", async () => {
    const user = userEvent.setup();
    const reasons: MenuCloseReason[] = [];
    render(
      <Demo reasons={reasons}>
        <MenuItem onClick={(e) => e.preventDefault()}>One</MenuItem>
        <MenuItem>Two</MenuItem>
      </Demo>,
    );
    await user.click(screen.getByText("trigger"));
    await user.keyboard("{Enter}");
    expect(reasons).toEqual([]);
    expect(menu()).toBeInTheDocument();
    expect(focused()).toBe(item("One"));
    await user.keyboard("{ArrowDown}");
    expect(focused()).toBe(item("Two"));
  });

  test("items swapped by the owner give the first item focus", async () => {
    const user = userEvent.setup();
    function Swap() {
      const [step, setStep] = useState(1);
      return (
        <Demo>
          {step === 1 ? (
            <MenuItem
              onClick={(e) => {
                e.preventDefault();
                setStep(2);
              }}
            >
              Next
            </MenuItem>
          ) : (
            <>
              <MenuItem>Alpha</MenuItem>
              <MenuItem>Beta</MenuItem>
            </>
          )}
        </Demo>
      );
    }
    render(<Swap />);
    await user.click(screen.getByText("trigger"));
    await user.keyboard("{Enter}");
    expect(screen.queryByText("Next")).toBeNull();
    expect(focused()).toBe(item("Alpha"));
  });

  test("a click on a disabled item calls nothing and does not close the menu", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const reasons: MenuCloseReason[] = [];
    render(
      <Demo reasons={reasons}>
        <MenuItem disabled onClick={onClick}>
          Locked
        </MenuItem>
        <MenuItem>Two</MenuItem>
      </Demo>,
    );
    await user.click(screen.getByText("trigger"));
    await user.click(item("Locked"));
    expect(onClick).not.toHaveBeenCalled();
    expect(reasons).toEqual([]);
    expect(menu()).toBeInTheDocument();
  });

  test("a handler that opens a Modal: the Modal returns focus to the anchor", async () => {
    const user = userEvent.setup();
    function Opens() {
      const t = useMenuTrigger<HTMLButtonElement>();
      const [modal, setModal] = useState(false);
      return (
        <>
          <button {...t.triggerProps}>trigger</button>
          <Menu {...t.menuProps} aria-label="m">
            <MenuItem onClick={() => setModal(true)}>Open it</MenuItem>
          </Menu>
          <Modal
            open={modal}
            title="T"
            closeLabel="Close"
            onRequestClose={() => setModal(false)}
          >
            x
          </Modal>
        </>
      );
    }
    render(<Opens />);
    const trigger = screen.getByText("trigger");
    await user.click(trigger);
    await user.click(item("Open it"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(focused()).toBe(trigger);
  });
});

describe("closing (R22)", () => {
  test("Esc: focus to the anchor and onClose(escape)", async () => {
    const user = userEvent.setup();
    const reasons: MenuCloseReason[] = [];
    render(<Demo reasons={reasons} ignoreClose />);
    const trigger = screen.getByText("trigger");
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(reasons).toEqual(["escape"]);
    expect(focused()).toBe(trigger);
    expect(menu()).toBeInTheDocument();
  });

  test("Tab and Shift+Tab: prevented, focus to the anchor, onClose(tab)", async () => {
    const user = userEvent.setup();
    const reasons: MenuCloseReason[] = [];
    render(<Demo reasons={reasons} />);
    const trigger = screen.getByText("trigger");
    await user.click(trigger);
    await user.tab();
    expect(reasons).toEqual(["tab"]);
    expect(focused()).toBe(trigger);
    expect(screen.queryByRole("menu")).toBeNull();
    await user.click(trigger);
    await user.tab({ shift: true });
    expect(reasons).toEqual(["tab", "tab"]);
    expect(focused()).toBe(trigger);
  });

  test("a press outside reports outside and moves no focus; a press on the anchor is not outside", async () => {
    const user = userEvent.setup();
    const reasons: MenuCloseReason[] = [];
    render(<Demo reasons={reasons} ignoreClose />);
    const trigger = screen.getByText("trigger");
    await user.click(trigger);
    const first = focused();
    fireEvent.pointerDown(screen.getByText("after"));
    expect(reasons).toEqual(["outside"]);
    expect(focused()).toBe(first);
    fireEvent.pointerDown(menu());
    fireEvent.pointerDown(trigger);
    expect(reasons).toEqual(["outside"]);
  });

  test("the anchor's own click toggles the menu", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    const trigger = screen.getByText("trigger");
    await user.click(trigger);
    expect(menu()).toBeInTheDocument();
    await user.click(trigger);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("whatever the reason, a closed menu with focus on the body gives it to the anchor", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    const trigger = screen.getByText("trigger");
    await user.click(trigger);
    fireEvent.pointerDown(screen.getByText("after"));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(focused()).toBe(trigger);
  });

  test("an anchor that cannot take focus: no error, no focus", async () => {
    const user = userEvent.setup();
    const reasons: MenuCloseReason[] = [];
    render(<Demo reasons={reasons} />);
    const trigger = screen.getByText("trigger");
    await user.click(trigger);
    trigger.style.visibility = "hidden";
    await user.keyboard("{Escape}");
    expect(reasons).toEqual(["escape"]);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(focused()).toBe(document.body);
  });
});

describe("position (R23)", () => {
  test("the inline left and top are the function's result and follow a resize", () => {
    const anchor = createRef<HTMLButtonElement>();
    let rect = { left: 500, top: 100, right: 600, bottom: 130 };
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (this.getAttribute("role") === "menu")
          return { width: 200, height: 100 } as DOMRect;
        return { ...rect, width: 100, height: 30, x: 0, y: 0 } as DOMRect;
      },
    );
    Object.defineProperty(window, "innerWidth", {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(window, "innerHeight", {
      value: 800,
      configurable: true,
    });
    render(
      <>
        <button ref={anchor}>a</button>
        <Menu open anchorRef={anchor} onClose={noop} aria-label="m" />
      </>,
    );
    expect(menu().style.left).toBe("400px");
    expect(menu().style.top).toBe("134px");
    rect = { left: 500, top: 200, right: 700, bottom: 230 };
    fireEvent(window, new Event("resize"));
    expect(menu().style.left).toBe("500px");
    expect(menu().style.top).toBe("234px");
    rect = { left: 500, top: 300, right: 700, bottom: 330 };
    fireEvent.scroll(document.body);
    expect(menu().style.top).toBe("334px");
  });

  test("a scroll inside the menu does not reposition it; a scroll elsewhere does", () => {
    const anchor = createRef<HTMLButtonElement>();
    let rect = { left: 500, top: 100, right: 600, bottom: 130 };
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (this.getAttribute("role") === "menu")
          return { width: 200, height: 100 } as DOMRect;
        return { ...rect, width: 100, height: 30, x: 0, y: 0 } as DOMRect;
      },
    );
    Object.defineProperty(window, "innerWidth", {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(window, "innerHeight", {
      value: 800,
      configurable: true,
    });
    render(
      <>
        <button ref={anchor}>a</button>
        <div id="other">other</div>
        <Menu open anchorRef={anchor} onClose={noop} aria-label="m">
          <MenuItem>One</MenuItem>
        </Menu>
      </>,
    );
    expect(menu().style.top).toBe("134px");
    rect = { left: 500, top: 300, right: 700, bottom: 330 };
    fireEvent.scroll(menu());
    fireEvent.scroll(item("One"));
    expect(menu().style.top).toBe("134px");
    fireEvent.scroll(document.getElementById("other")!);
    expect(menu().style.top).toBe("334px");
  });

  test("align start puts the left edge on the anchor's", () => {
    const anchor = createRef<HTMLButtonElement>();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (this.getAttribute("role") === "menu")
          return { width: 200, height: 100 } as DOMRect;
        return { left: 300, top: 0, right: 400, bottom: 30 } as DOMRect;
      },
    );
    Object.defineProperty(window, "innerWidth", {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(window, "innerHeight", {
      value: 800,
      configurable: true,
    });
    render(
      <>
        <button ref={anchor}>a</button>
        <Menu
          open
          anchorRef={anchor}
          onClose={noop}
          align="start"
          aria-label="m"
        />
      </>,
    );
    expect(menu().style.left).toBe("300px");
  });
});

describe("useMenuTrigger (R24)", () => {
  test("the trigger props, and the way to open", async () => {
    const user = userEvent.setup();
    let props: ReturnType<typeof useMenuTrigger<HTMLButtonElement>> | null =
      null;
    function T() {
      props = useMenuTrigger<HTMLButtonElement>();
      return (
        <>
          <button {...props.triggerProps}>t</button>
          <Menu {...props.menuProps} aria-label="m">
            <MenuItem>One</MenuItem>
            <MenuItem>Two</MenuItem>
          </Menu>
        </>
      );
    }
    render(<T />);
    const trigger = screen.getByText("t");
    expect(Object.keys(props!.triggerProps).sort()).toEqual([
      "aria-expanded",
      "aria-haspopup",
      "onClick",
      "onKeyDown",
      "ref",
    ]);
    expect(Object.keys(props!.menuProps).sort()).toEqual([
      "anchorRef",
      "onClose",
      "open",
      "openFocus",
    ]);
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(focused()).toBe(item("One"));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    act(() => trigger.focus());
    await user.keyboard("{ArrowDown}");
    expect(focused()).toBe(item("One"));
    await user.keyboard("{Escape}");
    act(() => trigger.focus());
    await user.keyboard("{ArrowUp}");
    expect(focused()).toBe(item("Two"));
    expect(props!.menuProps.openFocus).toBe("last");
    expect(props!.menuProps.anchorRef).toBe(props!.triggerProps.ref);
  });

  test("the triggerProps go on an IconButton, a Button and a plain button without a cast", async () => {
    const user = userEvent.setup();
    function Three() {
      const a = useMenuTrigger<HTMLButtonElement>();
      const b = useMenuTrigger<HTMLButtonElement>();
      const c = useMenuTrigger<HTMLButtonElement>();
      return (
        <>
          <IconButton icon="menu" label="Icon" {...a.triggerProps} />
          <Button {...b.triggerProps}>Button</Button>
          <button {...c.triggerProps}>Plain</button>
          <Menu {...a.menuProps} aria-label="a">
            <MenuItem>from icon</MenuItem>
          </Menu>
          <Menu {...b.menuProps} aria-label="b">
            <MenuItem>from button</MenuItem>
          </Menu>
          <Menu {...c.menuProps} aria-label="c">
            <MenuItem>from plain</MenuItem>
          </Menu>
        </>
      );
    }
    render(<Three />);
    await user.click(screen.getByRole("button", { name: "Icon" }));
    expect(screen.getByText("from icon")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Button" }));
    expect(screen.getByText("from button")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Plain" }));
    expect(screen.getByText("from plain")).toBeInTheDocument();
  });
});

describe("a Menu over dialogs (R9, R10, R12, R14, R15)", () => {
  function Stacked({ calls, opaque }: { calls: string[]; opaque?: boolean }) {
    const [b, setB] = useState(true);
    const t = useMenuTrigger<HTMLButtonElement>();
    return (
      <>
        <Modal
          open
          title="A"
          backdrop={opaque ? "opaque" : "dim"}
          onRequestClose={() => calls.push("A")}
        >
          a
        </Modal>
        <Modal
          open={b}
          title="B"
          onRequestClose={() => {
            calls.push("B");
            setB(false);
          }}
        >
          <button {...t.triggerProps}>trigger</button>
          <Menu
            {...t.menuProps}
            aria-label="m"
            onClose={(reason) => {
              calls.push(`menu:${reason}`);
              t.menuProps.onClose();
            }}
          >
            <MenuItem>One</MenuItem>
          </Menu>
        </Modal>
      </>
    );
  }

  test("with A, B and a Menu: three presses ask the Menu, then B, then A", async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    const parentKey = vi.fn();
    render(
      <div onKeyDown={parentKey}>
        <Stacked calls={calls} />
      </div>,
    );
    await user.click(screen.getByText("trigger"));
    expect(calls).toEqual([]);
    await user.keyboard("{Escape}");
    await user.keyboard("{Escape}");
    await user.keyboard("{Escape}");
    expect(calls).toEqual(["menu:escape", "B", "A"]);
    expect(parentKey).not.toHaveBeenCalled();
  });

  test("a Menu that opens in the same commit as the Modal it is a child of is asked first and keeps focus", async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    const anchor = createRef<HTMLButtonElement>();
    render(
      <Modal open title="T" onRequestClose={() => calls.push("modal")}>
        <button ref={anchor}>anchor</button>
        <Menu
          open
          anchorRef={anchor}
          aria-label="m"
          onClose={(r) => calls.push(`menu:${r}`)}
        >
          <MenuItem>One</MenuItem>
        </Menu>
      </Modal>,
    );
    expect(focused()).toBe(item("One"));
    await user.keyboard("{Escape}");
    expect(calls).toEqual(["menu:escape"]);
  });

  test("a press outside the Menu on the scrim of a dialog below closes the Menu only", async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    function Over() {
      const [open, setOpen] = useState(true);
      const anchor = useRef<HTMLButtonElement>(null);
      return (
        <>
          <Modal
            open
            title="A"
            onRequestClose={(r) => {
              calls.push(`modal:${r}`);
            }}
          >
            <button ref={anchor}>anchor</button>
          </Modal>
          <Menu
            open={open}
            anchorRef={anchor}
            aria-label="m"
            onClose={(r) => {
              calls.push(`menu:${r}`);
              setOpen(false);
            }}
          >
            <MenuItem>One</MenuItem>
          </Menu>
        </>
      );
    }
    render(<Over />);
    await user.click(document.querySelector(".scrim") as HTMLElement);
    expect(calls).toEqual(["menu:outside"]);
    // The next press, with no Menu, is the dialog's own.
    await user.click(document.querySelector(".scrim") as HTMLElement);
    expect(calls).toEqual(["menu:outside", "modal:outside"]);
  });

  test("Tab inside a Menu opened from a Modal goes to the anchor and the trap does not move it", async () => {
    const user = userEvent.setup();
    const reasons: string[] = [];
    function T() {
      const t = useMenuTrigger<HTMLButtonElement>();
      return (
        <Modal open title="T" closeLabel="Close" onRequestClose={noop}>
          <button>first</button>
          <button {...t.triggerProps}>trigger</button>
          <button>last</button>
          <Menu
            {...t.menuProps}
            aria-label="m"
            onClose={(r) => {
              reasons.push(r);
              t.menuProps.onClose();
            }}
          >
            <MenuItem>One</MenuItem>
          </Menu>
        </Modal>
      );
    }
    render(<T />);
    await user.click(screen.getByText("trigger"));
    expect(focused()).toBe(item("One"));
    await user.tab();
    expect(reasons).toEqual(["tab"]);
    expect(focused()).toBe(screen.getByText("trigger"));
  });

  test("scroll lock: a Menu does not lock; two dialogs and a Menu keep it until the last dialog closes", () => {
    const anchor = createRef<HTMLButtonElement>();
    const tree = (a: boolean, b: boolean, m: boolean) => (
      <>
        <button ref={anchor}>anchor</button>
        <Modal open={a} title="A" onRequestClose={noop}>
          a
        </Modal>
        <Modal open={b} title="B" onRequestClose={noop}>
          b
        </Modal>
        <Menu open={m} anchorRef={anchor} onClose={noop} aria-label="m" />
      </>
    );
    const { rerender } = render(tree(false, false, true));
    expect(document.body.style.overflow).toBe("");
    rerender(tree(true, true, true));
    expect(document.body.style.overflow).toBe("hidden");
    rerender(tree(false, true, true));
    expect(document.body.style.overflow).toBe("hidden");
    rerender(tree(false, false, true));
    expect(document.body.style.overflow).toBe("");
  });

  test("a Menu opened later over an opaque dialog is not inert and is interactive", async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    function Over() {
      const t = useMenuTrigger<HTMLButtonElement>();
      return (
        <>
          <div id="page">page</div>
          <Modal open title="A" backdrop="opaque" onRequestClose={noop}>
            <button {...t.triggerProps}>trigger</button>
          </Modal>
          <Menu {...t.menuProps} aria-label="m">
            <MenuItem onClick={() => calls.push("one")}>One</MenuItem>
          </Menu>
        </>
      );
    }
    render(<Over />);
    expect(document.getElementById("page")!.closest("[inert]")).not.toBeNull();
    await user.click(screen.getByText("trigger"));
    expect(menu().closest("[inert]")).toBeNull();
    expect(menu()).not.toHaveAttribute("aria-hidden");
    expect(focused()).toBe(item("One"));
    await user.keyboard("{Enter}");
    expect(calls).toEqual(["one"]);
  });

  test("in StrictMode the stack and the focus are right", async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <Demo />
      </StrictMode>,
    );
    const trigger = screen.getByText("trigger");
    await user.click(trigger);
    expect(layerCount()).toBe(1);
    expect(focused()).toBe(item("One"));
    await user.keyboard("{Escape}");
    expect(layerCount()).toBe(0);
    expect(focused()).toBe(trigger);
  });
});

describe("Menu types (R32)", () => {
  test("the type errors are marked and found by pnpm typecheck", () => {
    function types(anchor: RefObject<HTMLElement | null>) {
      return [
        // @ts-expect-error no name
        <Menu open anchorRef={anchor} onClose={noop} />,
        // @ts-expect-error no anchorRef
        <Menu open onClose={noop} aria-label="m" />,
        <Menu
          open
          anchorRef={anchor}
          onClose={noop}
          // @ts-expect-error align is end or start
          align="center"
          aria-label="m"
        />,
        // @ts-expect-error no onClose
        <Menu open anchorRef={anchor} aria-label="m" />,
        // @ts-expect-error variant is default or danger
        <MenuItem variant="loud">x</MenuItem>,
        // @ts-expect-error a group needs its label
        <MenuGroup>x</MenuGroup>,
        <Menu open anchorRef={anchor} onClose={noop} aria-labelledby="n" />,
      ];
    }
    expect(typeof types).toBe("function");
  });
});

describe("Menu.css (R25, Table C, Table D)", () => {
  test("holds exactly the rules of the tables", () => {
    expectCssTable(
      resolve(import.meta.dirname, "Menu.css"),
      [
        [
          ".menu",
          "position:fixed; min-width:200px; max-width:min(300px,92%); background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-sm); box-shadow:var(--pop); padding:4px; z-index:30; max-height:calc(100% - 16px); overflow-y:auto",
        ],
        [
          ".menu button",
          "display:flex; align-items:center; gap:10px; width:100%; padding:7px 10px; border-radius:7px; color:var(--ink); min-height:32px",
        ],
        [".menu button:hover", "background:var(--hover)"],
        [
          ".menu button:focus-visible",
          "background:var(--hover); outline-offset:-2px",
        ],
        [".menu button.dng", "color:var(--danger)"],
        [
          '.menu button[aria-disabled="true"]',
          "opacity:.5; cursor:not-allowed",
        ],
        [
          ".menu hr",
          "border:0; height:1px; background:var(--line); margin:4px 0",
        ],
        [
          ".menu .mt",
          "font-size:11.5px; color:var(--muted); padding:6px 10px 2px; font-weight:600",
        ],
      ],
      [[".menu button", "min-height:40px"]],
    );
  });
});
