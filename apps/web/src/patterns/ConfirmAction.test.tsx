// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Providers } from "../test/providers";
import { actionPatterns, type ActionId, type ConfirmActionId } from "./actions";
import { ConfirmAction } from "./ConfirmAction";
import { setConnectionCheck } from "./online";

afterEach(() => setConnectionCheck(null));

const base = {
  open: true,
  title: "Delete this message?",
  description: "It will be removed.",
  confirmLabel: "Delete",
};

function renderAction(over: Partial<Parameters<typeof ConfirmAction>[0]> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <Providers>
      <ConfirmAction
        action="deleteOwnMessage"
        target="Lan's message"
        onConfirm={onConfirm}
        onCancel={onCancel}
        {...base}
        {...over}
      />
    </Providers>,
  );
  return { onConfirm, onCancel };
}

const confirmIds = (Object.keys(actionPatterns) as ActionId[]).filter(
  (id): id is ConfirmActionId => actionPatterns[id].pattern === "confirm",
);

describe("ConfirmAction (R18)", () => {
  it("is a ConfirmDialog with the common Cancel text", () => {
    renderAction();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("online: onConfirm is called once", async () => {
    setConnectionCheck(() => true);
    const { onConfirm } = renderAction();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("offline: onConfirm is not called, the dialog stays open and a toast explains", async () => {
    setConnectionCheck(() => false);
    const { onConfirm } = renderAction();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText(
        "You are offline. Try again when the connection is back.",
      ),
    ).toBeInTheDocument();
  });

  it("forwards busy and the cancel reasons", async () => {
    const { onCancel } = renderAction();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledWith("cancel");
  });

  it("forwards busy", () => {
    renderAction({ busy: true });
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });

  it.each(confirmIds)(
    "%s shows its target in the dialog (AC-078)",
    (action) => {
      renderAction({ action, target: "Sample target" });
      expect(document.querySelector("p.cfm-target strong")).toHaveTextContent(
        "Sample target",
      );
    },
  );
});

describe("never both (R11)", () => {
  it("is a type error to give ConfirmAction an undo id, and a runtime error when cast", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <Providers>
          <ConfirmAction
            // @ts-expect-error an undo id is not a confirm id
            action="pinMessage"
            target="x"
            onConfirm={() => {}}
            onCancel={() => {}}
            {...base}
          />
        </Providers>,
      ),
    ).toThrow(/pinMessage.*undo|undo.*pinMessage/);
  });

  it("a row with no pattern is refused too", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <Providers>
          <ConfirmAction
            // @ts-expect-error an action that asks nothing is not a confirm id
            action="deleteUnsentMessage"
            target="x"
            onConfirm={() => {}}
            onCancel={() => {}}
            {...base}
          />
        </Providers>,
      ),
    ).toThrow(/deleteUnsentMessage/);
  });

  it("no file of apps/web/src outside patterns/ imports ConfirmDialog from @toki/ui-web (R11 d)", () => {
    const root = resolve(__dirname, "..");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          if (path !== join(root, "patterns")) walk(path);
        } else if (
          /\.(ts|tsx)$/.test(name) &&
          !/\.test\.(ts|tsx)$/.test(name)
        ) {
          files.push(path);
        }
      }
    };
    walk(root);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const importsIt =
        /import[^;]*\bConfirmDialog\b[^;]*from\s+["']@toki\/ui-web["']/s.test(
          text,
        );
      expect(importsIt, file).toBe(false);
    }
  });
});
