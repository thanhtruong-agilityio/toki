import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resolve } from "node:path";
import {
  createRef,
  StrictMode,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import * as focusModule from "../../../src/internal/overlays/focus";
import * as isolateModule from "../../../src/internal/overlays/isolate";
import * as lockModule from "../../../src/internal/overlays/scrollLock";
import { layerCount } from "../../../src/internal/overlays/stack";
import { expectCssTable } from "../../support/css-table";
import {
  dialogBackdrops,
  dialogCloseReasons,
  type DialogCloseReason,
} from "../../../src/components/Modal/Dialog";
import { Menu, MenuItem } from "../../../src/components/Menu";
import { Modal } from "../../../src/components/Modal/Modal";

// The folder this file sat in before the tests moved to tests/: its relative paths still start here.
const SRC_DIR = `${import.meta.dirname}/../../../src/components/Modal`;

const noop = () => {};

afterEach(() => {
  vi.restoreAllMocks();
  document.body.style.overflow = "";
});

function dialog(): HTMLElement {
  return screen.getByRole("dialog");
}

// An owner that opens the dialog from a button and closes it on every reason.
function Owner(props: {
  reasons?: DialogCloseReason[];
  backdrop?: "dim" | "opaque";
  returnFocus?: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
  initialOpen?: boolean;
  hideOpenerOnClose?: boolean;
  focusOtherOnClose?: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(props.initialOpen ?? false);
  const [showOpener, setShowOpener] = useState(true);
  const other = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (props.focusOtherOnClose && !open) other.current?.focus();
  }, [open, props.focusOtherOnClose]);
  return (
    <>
      {showOpener ? (
        <button id="opener" onClick={() => setOpen(true)}>
          open
        </button>
      ) : null}
      <input id="other" ref={other} aria-label="other" />
      <Modal
        open={open}
        title="Title"
        closeLabel="Close"
        backdrop={props.backdrop}
        returnFocus={props.returnFocus}
        returnFocusRef={props.returnFocusRef}
        onRequestClose={(reason) => {
          props.reasons?.push(reason);
          setOpen(false);
          if (props.hideOpenerOnClose) setShowOpener(false);
        }}
      >
        {props.children ?? <button>in</button>}
      </Modal>
    </>
  );
}

describe("Modal DOM (R5)", () => {
  test("form (a): scrim, panel, header, body, footer, in order, last child of body", () => {
    render(
      <>
        <div id="page" />
        <Modal
          open
          title="Hello"
          closeLabel="Close"
          footer={<button>ok</button>}
          onRequestClose={noop}
        >
          <p>body</p>
        </Modal>
      </>,
    );
    const scrim = document.body.lastElementChild as HTMLElement;
    expect(scrim.className).toBe("scrim");
    expect(scrim.children).toHaveLength(1);
    const panel = dialog();
    expect(panel.parentElement).toBe(scrim);
    expect(panel).toHaveAttribute("aria-modal", "true");
    expect(panel).toHaveAttribute("tabindex", "-1");
    expect(panel.className).toBe("modal");
    const [hd, bd, ft] = Array.from(panel.children);
    expect(hd!.className).toBe("mhd");
    expect(bd!.className).toBe("mbd");
    expect(ft!.className).toBe("mft");
    expect(panel.children).toHaveLength(3);
    const h2 = hd!.querySelector("h2")!;
    expect(h2).toHaveTextContent("Hello");
    expect(h2.id).not.toBe("");
    expect(panel).toHaveAttribute("aria-labelledby", h2.id);
    expect(screen.getByRole("dialog", { name: "Hello" })).toBe(panel);
    const close = hd!.querySelector("button")!;
    expect(close).toHaveAccessibleName("Close");
    expect(close.className).toBe("ib sm");
    expect(close.querySelector("svg")).not.toBeNull();
    expect(bd).toHaveTextContent("body");
    expect(ft).toHaveTextContent("ok");
  });

  test("no close button without closeLabel; no footer without footer", () => {
    render(
      <Modal open title="T" onRequestClose={noop}>
        x
      </Modal>,
    );
    const panel = dialog();
    expect(panel.querySelector(".mhd button")).toBeNull();
    expect(panel.querySelector(".mft")).toBeNull();
    expect(panel.querySelector(".mbd")).toHaveTextContent("x");
  });

  test("form (b): children directly, named by aria-label or aria-labelledby", () => {
    const { unmount } = render(
      <Modal open aria-label="Palette" onRequestClose={noop}>
        <input aria-label="q" />
      </Modal>,
    );
    let panel = dialog();
    expect(panel).toHaveAttribute("aria-label", "Palette");
    expect(panel).not.toHaveAttribute("aria-labelledby");
    expect(panel.querySelector(".mhd,.mbd,.mft")).toBeNull();
    expect(panel.firstElementChild?.tagName).toBe("INPUT");
    unmount();
    render(
      <>
        <span id="n">Named</span>
        <Modal open aria-labelledby="n" onRequestClose={noop}>
          x
        </Modal>
      </>,
    );
    panel = dialog();
    expect(panel).toHaveAttribute("aria-labelledby", "n");
    expect(screen.getByRole("dialog", { name: "Named" })).toBe(panel);
  });

  test("every other attribute passes to the panel", () => {
    render(
      <Modal open title="T" onRequestClose={noop} data-x="1" id="mine">
        x
      </Modal>,
    );
    expect(dialog()).toHaveAttribute("data-x", "1");
    expect(dialog()).toHaveAttribute("id", "mine");
  });
});

describe("Modal conventions (R2, R3, R7)", () => {
  test("ref is the panel; className comes after the own classes", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Modal ref={ref} open title="T" className="mine" onRequestClose={noop}>
        x
      </Modal>,
    );
    expect(ref.current).toBe(dialog());
    expect(dialog().className).toBe("modal mine");
  });

  test("owned attributes win over a cast spread", () => {
    const hostile = {
      role: "alert",
      "aria-modal": "false",
      tabIndex: 5,
    } as object;
    render(
      <Modal open title="T" onRequestClose={noop} {...hostile}>
        x
      </Modal>,
    );
    expect(dialog()).toHaveAttribute("role", "dialog");
    expect(dialog()).toHaveAttribute("aria-modal", "true");
    expect(dialog()).toHaveAttribute("tabindex", "-1");
  });

  test("the lists, and the defaults: dim backdrop, focus returned", async () => {
    expect(dialogBackdrops).toEqual(["dim", "opaque"]);
    expect(dialogCloseReasons).toEqual(["escape", "outside", "close"]);
    const user = userEvent.setup();
    render(<Owner />);
    await user.click(screen.getByText("open"));
    expect(document.querySelector(".scrim")).not.toHaveClass("opaque");
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByText("open"));
  });

  test("with every text empty and no children the text is empty", () => {
    render(
      <Modal open title="" closeLabel="" footer="" onRequestClose={noop} />,
    );
    expect(document.body.lastElementChild?.textContent).toBe("");
  });

  test("open is controlled: an owner that ignores a request leaves it open", async () => {
    const user = userEvent.setup();
    const onRequestClose = vi.fn();
    render(
      <Modal open title="T" closeLabel="Close" onRequestClose={onRequestClose}>
        <input aria-label="typed" />
      </Modal>,
    );
    await user.type(screen.getByLabelText("typed"), "abc");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onRequestClose).toHaveBeenCalledTimes(2);
    expect(dialog()).toBeInTheDocument();
    expect(screen.getByLabelText("typed")).toHaveValue("abc");
  });
});

describe("nothing is left when closed (R4)", () => {
  test("closed: no child of body, no lock, no inert, no listener; open then unmounted: the same", () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const before = document.body.children.length;
    const { rerender, unmount } = render(
      <Modal open={false} title="T" onRequestClose={noop} backdrop="opaque">
        x
      </Modal>,
    );
    expect(document.body.children.length).toBe(before + 1); // the RTL container
    expect(add).not.toHaveBeenCalled();
    rerender(
      <Modal open title="T" onRequestClose={noop} backdrop="opaque">
        x
      </Modal>,
    );
    expect(layerCount()).toBe(1);
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.querySelector("[inert]")).not.toBeNull();
    unmount();
    expect(layerCount()).toBe(0);
    expect(document.body.style.overflow).toBe("");
    expect(document.querySelector("[inert],[aria-hidden]")).toBeNull();
    for (const type of ["keydown", "focusin"]) {
      const added = add.mock.calls.filter((c) => c[0] === type).length;
      const removed = remove.mock.calls.filter((c) => c[0] === type).length;
      expect(added, type).toBeGreaterThan(0);
      expect(removed, type).toBe(added);
    }
    expect(document.querySelector(".scrim")).toBeNull();
  });
});

describe("close requests (R8)", () => {
  test("Esc, the close button, and a press that begins and ends on the scrim", async () => {
    const user = userEvent.setup();
    const reasons: DialogCloseReason[] = [];
    render(<Owner initialOpen reasons={reasons} />);
    await user.keyboard("{Escape}");
    expect(reasons).toEqual(["escape"]);
  });

  test("each reason", async () => {
    const user = userEvent.setup();
    const reasons: DialogCloseReason[] = [];
    const onRequestClose = (r: DialogCloseReason) => reasons.push(r);
    render(
      <Modal open title="T" closeLabel="Close" onRequestClose={onRequestClose}>
        <p>inside</p>
      </Modal>,
    );
    const scrim = document.querySelector(".scrim") as HTMLElement;
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(scrim);
    expect(reasons).toEqual(["escape", "close", "outside"]);
    // A press on the panel reports nothing.
    await user.click(screen.getByText("inside"));
    expect(reasons).toHaveLength(3);
  });

  test("a press that begins inside the panel and ends on the scrim is not outside", () => {
    const onRequestClose = vi.fn();
    render(
      <Modal open title="T" onRequestClose={onRequestClose}>
        <p>inside</p>
      </Modal>,
    );
    const scrim = document.querySelector(".scrim") as HTMLElement;
    fireEvent.pointerDown(screen.getByText("inside"), { bubbles: true });
    fireEvent.pointerUp(scrim);
    expect(onRequestClose).not.toHaveBeenCalled();
    // And the other way: begins on the scrim, ends inside.
    fireEvent.pointerDown(scrim);
    fireEvent.pointerUp(screen.getByText("inside"));
    expect(onRequestClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(scrim);
    fireEvent.pointerUp(scrim);
    expect(onRequestClose).toHaveBeenCalledWith("outside");
  });
});

describe("Esc and order (R9)", () => {
  test("two dialogs: B first, then A; the event is stopped", async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    const parentKey = vi.fn();
    const documentBubble = vi.fn();
    document.addEventListener("keydown", documentBubble);
    render(
      <div onKeyDown={parentKey}>
        <Modal open title="A" onRequestClose={() => calls.push("A")}>
          a
        </Modal>
        <Modal open title="B" onRequestClose={() => calls.push("B")}>
          b
        </Modal>
      </div>,
    );
    await user.keyboard("{Escape}");
    await user.keyboard("{Escape}");
    document.removeEventListener("keydown", documentBubble);
    expect(calls).toEqual(["B", "B"]);
    expect(parentKey).not.toHaveBeenCalled();
    expect(documentBubble).not.toHaveBeenCalled();
  });

  test("a later opening is above an earlier one", async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    function Two() {
      const [b, setB] = useState(false);
      return (
        <>
          <Modal
            open
            title="A"
            onRequestClose={() => calls.push("A")}
            footer={<button onClick={() => setB(true)}>openB</button>}
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
            b
          </Modal>
        </>
      );
    }
    render(<Two />);
    await user.click(screen.getByText("openB"));
    await user.keyboard("{Escape}");
    await user.keyboard("{Escape}");
    expect(calls).toEqual(["B", "A"]);
  });

  test("Escape during composition is ignored", () => {
    const onRequestClose = vi.fn();
    render(
      <Modal open title="T" onRequestClose={onRequestClose}>
        x
      </Modal>,
    );
    fireEvent.keyDown(document.body, { key: "Escape", isComposing: true });
    fireEvent.keyDown(document.body, { key: "Escape", keyCode: 229 });
    expect(onRequestClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onRequestClose).toHaveBeenCalledWith("escape");
  });
});

describe("focus in (R11)", () => {
  test("the element of initialFocusRef", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Modal
        open
        title="T"
        initialFocusRef={ref}
        onRequestClose={noop}
        closeLabel="Close"
      >
        <button>a</button>
        <button ref={ref}>b</button>
        <button data-autofocus>c</button>
      </Modal>,
    );
    expect(document.activeElement).toBe(ref.current);
  });

  test("else the first data-autofocus", () => {
    render(
      <Modal open title="T" onRequestClose={noop} closeLabel="Close">
        <button>a</button>
        <button data-autofocus>c</button>
      </Modal>,
    );
    expect(document.activeElement).toHaveTextContent("c");
  });

  test("else the first tabbable: the close button comes first", () => {
    render(
      <Modal open title="T" onRequestClose={noop} closeLabel="Close">
        <button>a</button>
      </Modal>,
    );
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Close" }),
    );
  });

  test("else the panel; a plain text with tabIndex -1 can be the first focus", () => {
    const { unmount } = render(
      <Modal open title="T" onRequestClose={noop}>
        <p>text</p>
      </Modal>,
    );
    expect(document.activeElement).toBe(dialog());
    unmount();
    const ref = createRef<HTMLParagraphElement>();
    render(
      <Modal open title="T" initialFocusRef={ref} onRequestClose={noop}>
        <p ref={ref} tabIndex={-1}>
          text
        </p>
      </Modal>,
    );
    expect(document.activeElement).toBe(ref.current);
  });
});

describe("focus trap (R12)", () => {
  function three() {
    return render(
      <>
        <button id="outside">outside</button>
        <Modal open title="T" onRequestClose={noop}>
          <button>b1</button>
          <button>b2</button>
          <button>b3</button>
        </Modal>
      </>,
    );
  }

  test("Tab on the last goes to the first; Shift+Tab on the first goes to the last", async () => {
    const user = userEvent.setup();
    three();
    expect(document.activeElement).toHaveTextContent("b1");
    await user.tab();
    expect(document.activeElement).toHaveTextContent("b2");
    await user.tab();
    expect(document.activeElement).toHaveTextContent("b3");
    await user.tab();
    expect(document.activeElement).toHaveTextContent("b1");
    await user.tab({ shift: true });
    expect(document.activeElement).toHaveTextContent("b3");
  });

  test("on the panel: Tab goes to the first, Shift+Tab to the last", async () => {
    const user = userEvent.setup();
    three();
    act(() => dialog().focus());
    await user.tab();
    expect(document.activeElement).toHaveTextContent("b1");
    act(() => dialog().focus());
    await user.tab({ shift: true });
    expect(document.activeElement).toHaveTextContent("b3");
  });

  test("a panel with no tabbable element keeps focus where it is", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLParagraphElement>();
    render(
      <Modal
        open
        aria-label="Ended"
        initialFocusRef={ref}
        onRequestClose={noop}
      >
        <p ref={ref} tabIndex={-1}>
          Session ended
        </p>
      </Modal>,
    );
    await user.tab();
    expect(document.activeElement).toBe(ref.current);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(ref.current);
  });

  test("a panel with one button and focus on the text: Tab goes to the button, a second Tab stays", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLParagraphElement>();
    render(
      <Modal
        open
        aria-label="Ended"
        initialFocusRef={ref}
        onRequestClose={noop}
      >
        <p ref={ref} tabIndex={-1}>
          text
        </p>
        <button>go</button>
      </Modal>,
    );
    await user.tab();
    expect(document.activeElement).toHaveTextContent("go");
    await user.tab();
    expect(document.activeElement).toHaveTextContent("go");
    act(() => ref.current!.focus());
    await user.tab({ shift: true });
    expect(document.activeElement).toHaveTextContent("go");
  });

  test("a focus that lands outside is moved back", () => {
    three();
    const outside = document.getElementById("outside")!;
    act(() => outside.focus());
    expect(document.activeElement).toHaveTextContent("b1");
  });

  test("a focus outside goes to the panel when it holds nothing tabbable", () => {
    render(
      <>
        <button id="outside">outside</button>
        <Modal open aria-label="x" onRequestClose={noop}>
          <p>text</p>
        </Modal>
      </>,
    );
    act(() => document.getElementById("outside")!.focus());
    expect(document.activeElement).toBe(dialog());
  });

  test("radio buttons, contenteditable and a disabled fieldset at the ends", async () => {
    const user = userEvent.setup();
    render(
      <Modal open aria-label="x" onRequestClose={noop}>
        <input type="radio" name="g" aria-label="r1" />
        <input type="radio" name="g" aria-label="r2" defaultChecked />
        <div contentEditable suppressContentEditableWarning aria-label="ce" />
        <fieldset disabled>
          <button>never</button>
        </fieldset>
      </Modal>,
    );
    expect(document.activeElement).toHaveAccessibleName("r2");
    await user.tab();
    expect(document.activeElement).toHaveAccessibleName("ce");
    await user.tab();
    expect(document.activeElement).toHaveAccessibleName("r2");
  });
});

describe("focus return (R13)", () => {
  test("each reason returns focus to the opener", async () => {
    const user = userEvent.setup();
    render(<Owner />);
    const opener = screen.getByText("open");
    for (const close of [
      () => user.keyboard("{Escape}"),
      () => user.click(screen.getByRole("button", { name: "Close" })),
      () => user.click(document.querySelector(".scrim") as HTMLElement),
    ]) {
      await user.click(opener);
      expect(dialog()).toContainElement(document.activeElement as HTMLElement);
      await close();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(opener);
    }
  });

  test("returnFocus false returns nothing", async () => {
    const user = userEvent.setup();
    render(<Owner returnFocus={false} />);
    await user.click(screen.getByText("open"));
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(document.body);
  });

  test("an opener that was removed gets no focus and raises no error", async () => {
    const user = userEvent.setup();
    render(<Owner hideOpenerOnClose />);
    await user.click(screen.getByText("open"));
    await user.keyboard("{Escape}");
    expect(screen.queryByText("open")).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  test("a hidden opener gets no focus and raises no error", async () => {
    const user = userEvent.setup();
    render(<Owner />);
    const opener = screen.getByText("open");
    await user.click(opener);
    opener.style.visibility = "hidden";
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(document.body);
  });

  test("an owner that moves focus in the same commit keeps it there", async () => {
    const user = userEvent.setup();
    render(<Owner focusOtherOnClose />);
    await user.click(screen.getByText("open"));
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByLabelText("other"));
  });

  test("closing B returns focus to the element of A that opened B", async () => {
    const user = userEvent.setup();
    function Stack() {
      const [b, setB] = useState(false);
      return (
        <>
          <Modal open title="A" onRequestClose={noop}>
            <button onClick={() => setB(true)}>openB</button>
          </Modal>
          <Modal open={b} title="B" onRequestClose={() => setB(false)}>
            <button>inB</button>
          </Modal>
        </>
      );
    }
    render(<Stack />);
    const openB = screen.getByText("openB");
    await user.click(openB);
    expect(document.activeElement).toHaveTextContent("inB");
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(openB);
  });

  test("opened with focus on the body: nothing returns; with returnFocusRef the ref gets focus", () => {
    function Bare({ target }: { target?: RefObject<HTMLElement | null> }) {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button id="t" ref={target as RefObject<HTMLButtonElement>}>
            target
          </button>
          <button id="o" onClick={() => setOpen(true)}>
            open
          </button>
          <Modal
            open={open}
            title="T"
            returnFocusRef={target}
            onRequestClose={() => setOpen(false)}
          >
            <button>in</button>
          </Modal>
        </>
      );
    }
    const first = render(<Bare />);
    // fireEvent.click does not move focus: the Safari case.
    fireEvent.click(first.container.querySelector("#o")!);
    expect(dialog()).toContainElement(document.activeElement as HTMLElement);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(document.activeElement).toBe(document.body);
    first.unmount();
    const target = createRef<HTMLElement>();
    const second = render(<Bare target={target} />);
    fireEvent.click(second.container.querySelector("#o")!);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(document.activeElement).toBe(target.current);
  });
});

describe("scroll lock (R14)", () => {
  test("held through two dialogs, released after the last", () => {
    document.body.style.overflow = "scroll";
    const { rerender } = render(
      <>
        <Modal open title="A" onRequestClose={noop}>
          a
        </Modal>
        <Modal open title="B" onRequestClose={noop}>
          b
        </Modal>
      </>,
    );
    expect(document.body.style.overflow).toBe("hidden");
    rerender(
      <>
        <Modal open title="A" onRequestClose={noop}>
          a
        </Modal>
        <Modal open={false} title="B" onRequestClose={noop}>
          b
        </Modal>
      </>,
    );
    expect(document.body.style.overflow).toBe("hidden");
    rerender(
      <>
        <Modal open={false} title="A" onRequestClose={noop}>
          a
        </Modal>
        <Modal open={false} title="B" onRequestClose={noop}>
          b
        </Modal>
      </>,
    );
    expect(document.body.style.overflow).toBe("scroll");
  });
});

// R13 is followed: focus goes back when the dialog or the Menu unmounts while
// open. The Errors section of the spec says the opposite and is to be
// corrected in a spec change.
describe("unmounted while open (R13)", () => {
  test("a dialog unmounted while open, its opener still in the page, gets focus back", async () => {
    const user = userEvent.setup();
    function Page({ show }: { show: boolean }) {
      return (
        <>
          <button id="op">op</button>
          {show ? (
            <Modal open title="T" onRequestClose={noop}>
              <button>in</button>
            </Modal>
          ) : null}
        </>
      );
    }
    const { rerender } = render(<Page show={false} />);
    await user.click(screen.getByText("op"));
    rerender(<Page show />);
    expect(document.activeElement).toBe(screen.getByText("in"));
    rerender(<Page show={false} />);
    expect(document.activeElement).toBe(document.getElementById("op"));
  });

  test("a Menu unmounted while open returns focus to its anchor", async () => {
    const user = userEvent.setup();
    function Page({ show }: { show: boolean }) {
      const anchor = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={anchor}>anchor</button>
          {show ? (
            <Menu open anchorRef={anchor} aria-label="m" onClose={noop}>
              <MenuItem>One</MenuItem>
            </Menu>
          ) : null}
        </>
      );
    }
    const { rerender } = render(<Page show={false} />);
    await user.click(screen.getByText("anchor"));
    rerender(<Page show />);
    expect(document.activeElement).toBe(screen.getByRole("menuitem"));
    rerender(<Page show={false} />);
    expect(document.activeElement).toBe(screen.getByText("anchor"));
  });
});

describe("opaque backdrop and the toast region (R15, R34)", () => {
  function Page({
    backdrop,
    open,
  }: {
    backdrop: "dim" | "opaque";
    open: boolean;
  }) {
    return (
      <>
        <div id="root">
          <div id="pane">page</div>
          <div id="region" data-layer-skip="" role="status">
            toast text
            <button id="toast-action">undo</button>
          </div>
        </div>
        <div id="side">side</div>
        <Modal open={open} title="T" backdrop={backdrop} onRequestClose={noop}>
          <button>in</button>
        </Modal>
      </>
    );
  }
  const q = (id: string) => document.getElementById(id)!;

  test("opaque: the class, the page is inert and hidden, the region and its container are not, all restored", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Page backdrop="opaque" open />);
    expect(document.querySelector(".scrim")).toHaveClass("opaque");
    for (const id of ["pane", "side"]) {
      const node = q(id);
      expect(node.closest("[inert]"), id).not.toBeNull();
    }
    expect(q("pane")).toHaveAttribute("inert");
    expect(q("pane")).toHaveAttribute("aria-hidden", "true");
    expect(q("side")).toHaveAttribute("inert");
    for (const id of ["root", "region"]) {
      expect(q(id)).not.toHaveAttribute("inert");
      expect(q(id)).not.toHaveAttribute("aria-hidden");
    }
    expect(screen.getByRole("status")).toHaveTextContent("toast text");
    expect(dialog()).not.toHaveAttribute("inert");
    // Tab never lands in the region, which holds a focusable button.
    expect(document.activeElement).toBe(screen.getByText("in"));
    for (let i = 0; i < 3; i += 1) {
      await user.tab();
      expect(q("region").contains(document.activeElement)).toBe(false);
      expect(dialog().contains(document.activeElement)).toBe(true);
    }
    await user.tab({ shift: true });
    expect(q("region").contains(document.activeElement)).toBe(false);
    rerender(<Page backdrop="opaque" open={false} />);
    expect(document.querySelector("[inert],[aria-hidden]")).toBeNull();
  });

  test("the isolation follows backdrop while open; focus and the lock do not change", () => {
    const lock = vi.spyOn(lockModule, "lockScroll");
    const unlock = vi.spyOn(lockModule, "unlockScroll");
    const focus = vi.spyOn(focusModule, "focusInto");
    const { rerender } = render(<Page backdrop="dim" open />);
    const inner = screen.getByText("in");
    expect(document.querySelector("[inert]")).toBeNull();
    expect(document.activeElement).toBe(inner);
    expect(lock).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledTimes(1);
    rerender(<Page backdrop="opaque" open />);
    expect(document.querySelector(".scrim")).toHaveClass("opaque");
    expect(q("pane")).toHaveAttribute("inert");
    expect(q("pane")).toHaveAttribute("aria-hidden", "true");
    expect(q("region")).not.toHaveAttribute("inert");
    expect(document.activeElement).toBe(inner);
    rerender(<Page backdrop="dim" open />);
    expect(document.querySelector(".scrim")).not.toHaveClass("opaque");
    expect(document.querySelector("[inert],[aria-hidden]")).toBeNull();
    expect(document.activeElement).toBe(inner);
    expect(document.body.style.overflow).toBe("hidden");
    expect(lock).toHaveBeenCalledTimes(1);
    expect(unlock).not.toHaveBeenCalled();
    expect(focus).toHaveBeenCalledTimes(1);
    rerender(<Page backdrop="opaque" open />);
    rerender(<Page backdrop="opaque" open={false} />);
    expect(document.querySelector("[inert],[aria-hidden]")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(unlock).toHaveBeenCalledTimes(1);
  });

  test("a Menu that is open from the first render of an opaque Modal is above it: not inert, not hidden, asked first by Esc", async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    const anchor = createRef<HTMLButtonElement>();
    render(
      <>
        <div id="page">page</div>
        <Modal
          open
          title="T"
          backdrop="opaque"
          onRequestClose={() => calls.push("modal")}
        >
          <button ref={anchor}>anchor</button>
          <Menu
            open
            anchorRef={anchor}
            aria-label="m"
            onClose={(r) => calls.push(`menu:${r}`)}
          >
            <MenuItem>One</MenuItem>
          </Menu>
        </Modal>
      </>,
    );
    const menu = screen.getByRole("menu");
    expect(menu.closest("[inert]")).toBeNull();
    expect(menu.closest("[aria-hidden]")).toBeNull();
    expect(document.getElementById("page")!.closest("[inert]")).not.toBeNull();
    expect(dialog().closest("[inert]")).toBeNull();
    await user.keyboard("{Escape}");
    expect(calls).toEqual(["menu:escape"]);
  });

  test("dim: nothing is changed", () => {
    render(<Page backdrop="dim" open />);
    expect(document.querySelector("[inert],[aria-hidden]")).toBeNull();
  });

  test("a layer that opens later is not affected", () => {
    const { rerender } = render(
      <>
        <div id="p">page</div>
        <Modal open title="A" backdrop="opaque" onRequestClose={noop}>
          a
        </Modal>
      </>,
    );
    rerender(
      <>
        <div id="p">page</div>
        <Modal open title="A" backdrop="opaque" onRequestClose={noop}>
          a
        </Modal>
        <Modal open title="B" onRequestClose={noop}>
          b
        </Modal>
      </>,
    );
    expect(screen.getByRole("dialog", { name: "B" })).not.toHaveAttribute(
      "inert",
    );
    expect(
      screen.getByRole("dialog", { name: "B" }).closest("[inert]"),
    ).toBeNull();
  });
});

describe("a dialog that cannot be dismissed (R16)", () => {
  test.each(["a", "b"])(
    "form (%s): Esc, an outside press and Tab leave it open",
    async (form) => {
      const user = userEvent.setup();
      const ref = createRef<HTMLParagraphElement>();
      const onRequestClose = vi.fn();
      const text = (
        <p ref={ref} tabIndex={-1}>
          Your session has ended
        </p>
      );
      render(
        form === "a" ? (
          <Modal
            open
            title="Ended"
            backdrop="opaque"
            returnFocus={false}
            initialFocusRef={ref}
            onRequestClose={onRequestClose}
          >
            {text}
          </Modal>
        ) : (
          <Modal
            open
            aria-label="Ended"
            backdrop="opaque"
            returnFocus={false}
            initialFocusRef={ref}
            onRequestClose={onRequestClose}
          >
            {text}
          </Modal>
        ),
      );
      expect(document.activeElement).toBe(ref.current);
      expect(dialog().querySelector(".mhd button")).toBeNull();
      await user.tab();
      await user.tab({ shift: true });
      expect(document.activeElement).toBe(ref.current);
      await user.keyboard("{Escape}");
      await user.click(document.querySelector(".scrim") as HTMLElement);
      expect(dialog()).toBeInTheDocument();
      expect(onRequestClose.mock.calls.map((c) => c[0])).toEqual([
        "escape",
        "outside",
      ]);
    },
  );
});

describe("order of the steps (R33)", () => {
  test("opener, lock, isolation, focus on open; isolation and lock released before focus returns", async () => {
    const order: string[] = [];
    const wrap = <T extends object, K extends keyof T>(
      mod: T,
      name: K,
      label: string,
    ) => {
      const real = mod[name] as unknown as (...a: unknown[]) => unknown;
      vi.spyOn(mod, name as never).mockImplementation(((...a: unknown[]) => {
        order.push(label);
        return real(...a);
      }) as never);
    };
    wrap(focusModule, "recordOpener", "opener");
    wrap(lockModule, "lockScroll", "lock");
    wrap(isolateModule, "isolate", "isolate");
    wrap(focusModule, "focusInto", "focus");
    const user = userEvent.setup();
    render(<Owner backdrop="opaque" />);
    await user.click(screen.getByText("open"));
    expect(order).toEqual(["opener", "lock", "isolate", "focus"]);
    await user.keyboard("{Escape}");
    expect(document.body.style.overflow).toBe("");
    expect(document.querySelector("[inert]")).toBeNull();
    expect(document.activeElement).toBe(screen.getByText("open"));
  });

  test("an opaque dialog over a dim one: closing it returns focus into the dim one", async () => {
    const user = userEvent.setup();
    function Both() {
      const [b, setB] = useState(false);
      return (
        <>
          <Modal open title="A" onRequestClose={noop}>
            <button onClick={() => setB(true)}>openB</button>
          </Modal>
          <Modal
            open={b}
            title="B"
            backdrop="opaque"
            onRequestClose={() => setB(false)}
          >
            <button>inB</button>
          </Modal>
        </>
      );
    }
    render(<Both />);
    const openB = screen.getByText("openB");
    await user.click(openB);
    expect(openB.closest("[inert]")).not.toBeNull();
    await user.keyboard("{Escape}");
    expect(openB.closest("[inert]")).toBeNull();
    expect(document.activeElement).toBe(openB);
  });

  test("in StrictMode the opener is still the button that opened it", async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <Owner backdrop="opaque" />
      </StrictMode>,
    );
    const opener = screen.getByText("open");
    await user.click(opener);
    expect(dialog()).toContainElement(document.activeElement as HTMLElement);
    expect(document.body.style.overflow).toBe("hidden");
    expect(layerCount()).toBe(1);
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).toBe("");
    expect(document.querySelector("[inert],[aria-hidden]")).toBeNull();
    expect(layerCount()).toBe(0);
  });
});

describe("effects depend on open only", () => {
  test("an owner that re-renders with an inline handler does not pull focus back", () => {
    function Rerender() {
      const [, setN] = useState(0);
      return (
        <>
          <button onClick={() => setN((n) => n + 1)}>tick</button>
          <Modal open title="T" onRequestClose={() => {}}>
            <input aria-label="first" />
            <input aria-label="second" />
          </Modal>
        </>
      );
    }
    render(<Rerender />);
    const second = screen.getByLabelText("second");
    act(() => second.focus());
    const lock = vi.spyOn(lockModule, "lockScroll");
    // Re-render the owner with a new inline handler.
    act(() => {
      fireEvent.click(screen.getByText("tick"), {});
    });
    expect(document.activeElement).toBe(second);
    expect(lock).not.toHaveBeenCalled();
  });
});

describe("Modal types (R32)", () => {
  test("the type errors are marked and found by pnpm typecheck", () => {
    function types() {
      return [
        // @ts-expect-error neither title nor a name
        <Modal open onRequestClose={noop} />,
        // @ts-expect-error title and aria-label together
        <Modal open title="T" aria-label="x" onRequestClose={noop} />,
        // @ts-expect-error closeLabel with no title
        <Modal open aria-label="x" closeLabel="c" onRequestClose={noop} />,
        // @ts-expect-error no onRequestClose
        <Modal open title="T" />,
        // @ts-expect-error footer with no title
        <Modal open aria-label="x" footer="f" onRequestClose={noop} />,
        // @ts-expect-error backdrop is dim or opaque
        <Modal open title="T" backdrop="dark" onRequestClose={noop} />,
        <Modal open aria-labelledby="n" onRequestClose={noop} />,
      ];
    }
    expect(typeof types).toBe("function");
  });
});

describe("Modal.css (R25, Table A, Table D)", () => {
  test("holds exactly the rules of the tables", () => {
    expectCssTable(
      resolve(SRC_DIR, "Modal.css"),
      [
        [
          ".scrim",
          "position:fixed; inset:0; z-index:20; background:var(--scrim); display:grid; place-items:center; padding:16px",
        ],
        [".scrim.opaque", "background:var(--bg)"],
        [
          ".modal",
          "background:var(--surface); border-radius:var(--radius); box-shadow:var(--pop); width:min(520px,100%); max-height:100%; overflow:auto; border:1px solid var(--line); overscroll-behavior:contain",
        ],
        [".modal:focus-visible", "outline:0"],
        [
          ".modal .mhd",
          "display:flex; align-items:center; padding:16px 18px 6px; gap:8px; position:sticky; top:0; z-index:1; background:var(--surface)",
        ],
        [
          ".modal .mhd h2",
          'margin:0; font-size:17px; flex:1; font-family:"Bricolage Grotesque",sans-serif',
        ],
        [".modal .mbd", "padding:6px 18px 12px"],
        [
          ".modal .mft",
          "display:flex; justify-content:flex-end; gap:8px; padding:10px 18px 16px",
        ],
      ],
      [
        [".scrim", "padding:12px"],
        [".modal", "width:100%"],
      ],
    );
  });
});
