import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRef, useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { expectCssTable } from "../../support/css-table";
import type { DialogCloseReason } from "../../../src/components/Modal/Dialog";
import { Sheet } from "../../../src/components/Sheet/Sheet";

// The folder this file sat in before the tests moved to tests/: its relative paths still start here.
const SRC_DIR = `${import.meta.dirname}/../../../src/components/Sheet`;

const noop = () => {};

describe("Sheet DOM (R6)", () => {
  test("renders as Modal does; the scrim has the classes scrim sheet", () => {
    render(
      <Sheet
        open
        title="More"
        closeLabel="Close"
        footer={<button>ok</button>}
        onRequestClose={noop}
        data-x="1"
        className="mine"
      >
        <p>body</p>
      </Sheet>,
    );
    const scrim = document.body.lastElementChild as HTMLElement;
    expect(scrim.className).toBe("scrim sheet");
    const panel = screen.getByRole("dialog", { name: "More" });
    expect(panel.parentElement).toBe(scrim);
    expect(panel.className).toBe("modal mine");
    expect(panel).toHaveAttribute("aria-modal", "true");
    expect(panel).toHaveAttribute("tabindex", "-1");
    expect(panel).toHaveAttribute("data-x", "1");
    expect(Array.from(panel.children).map((c) => c.className)).toEqual([
      "mhd",
      "mbd",
      "mft",
    ]);
  });

  test("opaque adds its class beside sheet; form (b) has no header", () => {
    render(
      <Sheet open aria-label="x" backdrop="opaque" onRequestClose={noop}>
        <p>t</p>
      </Sheet>,
    );
    expect(document.querySelector(".scrim")?.className).toBe(
      "scrim sheet opaque",
    );
    expect(document.querySelector(".mhd")).toBeNull();
  });

  test("ref points at the dialog; owned attributes win", () => {
    const ref = createRef<HTMLDivElement>();
    const hostile = { role: "alert", "aria-modal": "false" } as object;
    render(
      <Sheet ref={ref} open title="T" onRequestClose={noop} {...hostile}>
        x
      </Sheet>,
    );
    expect(ref.current).toBe(screen.getByRole("dialog"));
    expect(ref.current).toHaveAttribute("aria-modal", "true");
  });

  test("with every text empty and no children the text is empty", () => {
    render(<Sheet open title="" closeLabel="" onRequestClose={noop} />);
    expect(document.body.lastElementChild?.textContent).toBe("");
  });
});

describe("Sheet behaves as Modal does (R6)", () => {
  test("reasons, focus in, trap, scroll lock and focus return", async () => {
    const user = userEvent.setup();
    const reasons: DialogCloseReason[] = [];
    function Owner() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>open</button>
          <Sheet
            open={open}
            title="More"
            closeLabel="Close"
            onRequestClose={(r) => {
              reasons.push(r);
              setOpen(false);
            }}
          >
            <button>b1</button>
          </Sheet>
        </>
      );
    }
    render(<Owner />);
    const opener = screen.getByText("open");
    for (const close of [
      () => user.keyboard("{Escape}"),
      () => user.click(screen.getByRole("button", { name: "Close" })),
      () => user.click(document.querySelector(".scrim") as HTMLElement),
    ]) {
      await user.click(opener);
      expect(document.activeElement).toHaveAccessibleName("Close");
      expect(document.body.style.overflow).toBe("hidden");
      await user.tab();
      await user.tab();
      expect(document.activeElement).toHaveAccessibleName("Close");
      await close();
      expect(document.body.style.overflow).toBe("");
      expect(document.activeElement).toBe(opener);
    }
    expect(reasons).toEqual(["escape", "close", "outside"]);
  });

  test("a request that the owner ignores leaves it open", async () => {
    const user = userEvent.setup();
    const onRequestClose = vi.fn();
    render(
      <Sheet open title="T" onRequestClose={onRequestClose}>
        <input aria-label="typed" />
      </Sheet>,
    );
    await user.type(screen.getByLabelText("typed"), "abc");
    await user.keyboard("{Escape}");
    expect(onRequestClose).toHaveBeenCalledWith("escape");
    expect(screen.getByLabelText("typed")).toHaveValue("abc");
  });
});

describe("Sheet source and types (R25, R32)", () => {
  test("Sheet.tsx imports Sheet.css and Modal.css's owner is Dialog", () => {
    const sheet = readFileSync(resolve(SRC_DIR, "Sheet.tsx"), "utf8");
    expect(sheet).toContain('import "./Sheet.css";');
    expect(sheet).toContain('import "../Modal/Modal.css";');
  });

  test("the type errors are marked and found by pnpm typecheck", () => {
    function types() {
      return [
        // @ts-expect-error neither title nor a name
        <Sheet open onRequestClose={noop} />,
        // @ts-expect-error title and aria-label together
        <Sheet open title="T" aria-label="x" onRequestClose={noop} />,
        // @ts-expect-error closeLabel with no title
        <Sheet open aria-label="x" closeLabel="c" onRequestClose={noop} />,
        // @ts-expect-error no onRequestClose
        <Sheet open title="T" />,
        // @ts-expect-error footer with no title
        <Sheet open aria-label="x" footer="f" onRequestClose={noop} />,
        // @ts-expect-error backdrop is dim or opaque
        <Sheet open title="T" backdrop="dark" onRequestClose={noop} />,
      ];
    }
    expect(typeof types).toBe("function");
  });
});

describe("Sheet.css (R25, Table B)", () => {
  test("holds exactly the rules of the table, and no narrow rule", () => {
    expectCssTable(resolve(SRC_DIR, "Sheet.css"), [
      [".scrim.sheet", "place-items:end center; padding:0"],
      [
        ".scrim.sheet .modal",
        "width:min(520px,100%); max-height:calc(100% - 48px); border-radius:var(--radius) var(--radius) 0 0; border-bottom:0; padding-bottom:env(safe-area-inset-bottom,0px)",
      ],
    ]);
  });
});
