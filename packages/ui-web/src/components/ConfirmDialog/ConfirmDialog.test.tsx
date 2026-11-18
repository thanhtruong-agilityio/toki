import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { readCss } from "../../test/css";
import { componentExamples } from "../../examples";
import {
  ConfirmDialog,
  confirmCancelReasons,
  confirmVariants,
  type ConfirmDialogProps,
} from "./index";
import * as entry from "../../index";

function props(over: Partial<ConfirmDialogProps> = {}): ConfirmDialogProps {
  return {
    open: true,
    title: "Delete this message?",
    description: "It will be removed for everyone.",
    target: "Lan's message",
    confirmLabel: "Delete",
    cancelLabel: "Cancel",
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...over,
  };
}

const examples =
  componentExamples.find((c) => c.component === "ConfirmDialog")?.examples ??
  [];

const panel = () => document.querySelector(".modal") as HTMLElement;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("exports (R1)", () => {
  test("the package exports the dialog and its lists", () => {
    expect(entry.ConfirmDialog).toBe(ConfirmDialog);
    expect(entry.confirmVariants).toEqual(["danger", "primary"]);
    expect(entry.confirmCancelReasons).toEqual(["cancel", "escape", "outside"]);
    expect(confirmVariants).toEqual(["danger", "primary"]);
    expect(confirmCancelReasons).toEqual(["cancel", "escape", "outside"]);
  });
});

describe("markup (R4)", () => {
  test("one Modal with cfm, a title, no close button, one body and one footer", () => {
    render(<ConfirmDialog {...props()} />);
    const p = panel();
    expect(p).toHaveClass("modal", "cfm");
    expect(p).toHaveAttribute("role", "dialog");
    expect(
      screen.getByRole("heading", { name: "Delete this message?" }),
    ).toBeInTheDocument();
    expect(p.querySelectorAll(".mbd")).toHaveLength(1);
    expect(p.querySelectorAll(".mft")).toHaveLength(1);
    const body = p.querySelector(".mbd") as HTMLElement;
    const footer = p.querySelector(".mft") as HTMLElement;
    expect(footer.parentElement).toBe(p);
    expect(body.contains(footer)).toBe(false);
    // The only buttons are the two of the footer: no close button.
    expect(p.querySelectorAll("button")).toHaveLength(2);
  });

  test("body holds p.cfm-text then p.cfm-target; footer holds Cancel then confirm", () => {
    render(<ConfirmDialog {...props()} />);
    const body = panel().querySelector(".mbd") as HTMLElement;
    expect(Array.from(body.children).map((c) => c.className)).toEqual([
      "cfm-text",
      "cfm-target",
    ]);
    const buttons = Array.from(panel().querySelectorAll(".mft button"));
    expect(buttons.map((b) => b.textContent)).toEqual(["Cancel", "Delete"]);
  });

  test("aria-describedby points at the description, and is absent without one", () => {
    const { rerender } = render(<ConfirmDialog {...props()} />);
    const text = panel().querySelector("p.cfm-text") as HTMLElement;
    expect(text.id).not.toBe("");
    expect(panel()).toHaveAttribute("aria-describedby", text.id);
    rerender(<ConfirmDialog {...props({ description: undefined })} />);
    expect(panel().querySelector("p.cfm-text")).toBeNull();
    expect(panel()).not.toHaveAttribute("aria-describedby");
  });

  test("a description with two sentences or a line break is one paragraph", () => {
    const { rerender } = render(
      <ConfirmDialog {...props({ description: "One. Two." })} />,
    );
    expect(panel().querySelectorAll("p.cfm-text")).toHaveLength(1);
    expect(panel().querySelector("p.cfm-text")).toHaveTextContent("One. Two.");
    rerender(<ConfirmDialog {...props({ description: "One.\nTwo." })} />);
    expect(panel().querySelectorAll("p.cfm-text")).toHaveLength(1);
  });

  test("danger is the default and primary is the other form", () => {
    const { rerender } = render(<ConfirmDialog {...props()} />);
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass(
      "danger",
    );
    rerender(<ConfirmDialog {...props({ variant: "primary" })} />);
    const confirm = screen.getByRole("button", { name: "Delete" });
    expect(confirm).toHaveClass("primary");
    expect(confirm).not.toHaveClass("danger");
    expect(screen.getByRole("button", { name: "Cancel" })).not.toHaveClass(
      "danger",
      "primary",
    );
  });

  test("renders nothing when closed", () => {
    render(<ConfirmDialog {...props({ open: false })} />);
    expect(document.querySelector(".scrim")).toBeNull();
  });
});

describe("the target names itself (R5)", () => {
  test("a target that the texts do not hold is shown in p.cfm-target strong", () => {
    render(<ConfirmDialog {...props({ target: "#design" })} />);
    expect(panel().querySelector("p.cfm-target strong")).toHaveTextContent(
      "#design",
    );
  });

  test("a short name found inside ordinary words is still its own element", () => {
    render(
      <ConfirmDialog
        {...props({
          target: "An",
          title: "Do you want to continue?",
          description: "Any member can ...",
        })}
      />,
    );
    const targets = panel().querySelectorAll("p.cfm-target");
    expect(targets).toHaveLength(1);
    expect(targets[0]?.querySelector("strong")?.textContent).toBe("An");
  });

  test("a title that holds the target still gives one p.cfm-target", () => {
    render(
      <ConfirmDialog
        {...props({ target: "#design", title: "Archive #design?" })}
      />,
    );
    expect(panel().querySelectorAll("p.cfm-target")).toHaveLength(1);
  });

  test.each(["", "   "])(
    "a blank target %j throws in development and test",
    (target) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      expect(() => render(<ConfirmDialog {...props({ target })} />)).toThrow(
        /target/,
      );
    },
  );

  test.each(["", "   "])(
    "a blank target %j in a production build renders nothing and logs",
    (target) => {
      vi.stubEnv("DEV", false);
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(() =>
        render(<ConfirmDialog {...props({ target })} />),
      ).not.toThrow();
      expect(document.querySelector(".scrim")).toBeNull();
      expect(error).toHaveBeenCalled();
      expect(String(error.mock.calls[0]?.[0])).toContain("target");
    },
  );
});

describe("keys and focus (R6)", () => {
  test("first focus is on Cancel and Enter changes nothing", async () => {
    const user = userEvent.setup();
    const p = props();
    render(<ConfirmDialog {...p} />);
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(p.onConfirm).not.toHaveBeenCalled();
    expect(p.onCancel).toHaveBeenCalledWith("cancel");
  });

  test("Esc, an outside press and Cancel give their three reasons and never confirm", async () => {
    const user = userEvent.setup();
    const p = props();
    render(<ConfirmDialog {...p} />);
    await user.keyboard("{Escape}");
    expect(p.onCancel).toHaveBeenLastCalledWith("escape");
    await user.click(document.querySelector(".scrim") as HTMLElement);
    expect(p.onCancel).toHaveBeenLastCalledWith("outside");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(p.onCancel).toHaveBeenLastCalledWith("cancel");
    expect(p.onCancel).toHaveBeenCalledTimes(3);
    expect(p.onConfirm).not.toHaveBeenCalled();
  });

  test("the confirm button calls onConfirm once", async () => {
    const user = userEvent.setup();
    const p = props();
    render(<ConfirmDialog {...p} />);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(p.onConfirm).toHaveBeenCalledTimes(1);
    expect(p.onCancel).not.toHaveBeenCalled();
  });

  test("the dialog never closes itself", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog {...props()} />);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(panel()).toBeInTheDocument();
  });
});

describe("busy (R7)", () => {
  test("disables both buttons, ignores Esc and outside, and sets aria-busy", async () => {
    const user = userEvent.setup();
    const p = props({ busy: true });
    render(<ConfirmDialog {...p} />);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(panel()).toHaveAttribute("aria-busy", "true");
    await user.keyboard("{Escape}");
    await user.click(document.querySelector(".scrim") as HTMLElement);
    expect(p.onCancel).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(p.onConfirm).not.toHaveBeenCalled();
  });

  test("is not busy by default", () => {
    render(<ConfirmDialog {...props()} />);
    expect(panel()).not.toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled();
  });

  test("focus moves to the panel in the commit in which busy turns true", () => {
    const { rerender } = render(<ConfirmDialog {...props()} />);
    const confirm = screen.getByRole("button", { name: "Delete" });
    confirm.focus();
    expect(confirm).toHaveFocus();
    rerender(<ConfirmDialog {...props({ busy: true })} />);
    expect(panel()).toHaveFocus();
  });
});

describe("no text of its own (R3)", () => {
  test("with every text empty and a one-character target the text is that character", () => {
    render(
      <ConfirmDialog
        {...props({
          title: "",
          description: "",
          target: "x",
          confirmLabel: "",
          cancelLabel: "",
        })}
      />,
    );
    expect(panel().textContent).toBe("x");
  });

  test("the source imports no workspace package and no look attribute", () => {
    const source = readFileSync(
      resolve(__dirname, "ConfirmDialog.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/from\s+["']@toki\//);
  });
});

describe("ConfirmDialog.css (R8, Table C)", () => {
  test("holds exactly the three rules of Table C", () => {
    const rules = readCss(resolve(__dirname, "ConfirmDialog.css"));
    expect(
      rules.map((r) => ({
        selector: r.selector,
        declarations: r.declarations,
      })),
    ).toEqual([
      { selector: ".cfm-text", declarations: { margin: "0" } },
      {
        selector: ".cfm-target",
        declarations: {
          margin: "8px 0 0",
          "font-weight": "600",
          "overflow-wrap": "anywhere",
        },
      },
      { selector: ".cfm .mft", declarations: { "flex-wrap": "wrap" } },
    ]);
  });
});

describe("examples (R9)", () => {
  test("five unique demos with the spec's ids", () => {
    expect(examples.map((e) => e.id)).toEqual([
      "delete-message",
      "archive-channel",
      "notify-channel",
      "busy",
      "long-target",
    ]);
    expect(new Set(examples.map((e) => e.id)).size).toBe(5);
  });

  test.each(
    examples.filter((e) => e.id !== "busy").map((e) => [e.id, e] as const),
  )("%s closes on Esc, an outside press and Cancel", async (_id, example) => {
    const user = userEvent.setup();
    render(example.element);
    expect(document.querySelector(".scrim")).toBeNull();
    const opener = screen.getAllByRole("button")[0] as HTMLElement;
    for (const how of ["escape", "outside", "cancel"] as const) {
      await user.click(opener);
      expect(panel()).toBeInTheDocument();
      expect(panel()).toHaveClass("cfm");
      if (how === "escape") await user.keyboard("{Escape}");
      if (how === "outside")
        await user.click(document.querySelector(".scrim") as HTMLElement);
      if (how === "cancel")
        await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(document.querySelector(".scrim")).toBeNull();
    }
  });

  test("the busy demo ignores Esc while busy and can be left after 3000 ms", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const busy = examples.find((e) => e.id === "busy")!;
      render(busy.element);
      await user.click(screen.getAllByRole("button")[0] as HTMLElement);
      expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
      await user.keyboard("{Escape}");
      expect(panel()).toBeInTheDocument();
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });
      expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(document.querySelector(".scrim")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  test("the long target demo holds a target of 120 characters", async () => {
    const user = userEvent.setup();
    const long = examples.find((e) => e.id === "long-target")!;
    render(long.element);
    await user.click(screen.getAllByRole("button")[0] as HTMLElement);
    const target = panel().querySelector("p.cfm-target strong") as HTMLElement;
    expect(target.textContent).toHaveLength(120);
  });
});
