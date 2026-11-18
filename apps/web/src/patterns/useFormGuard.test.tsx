import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, Modal } from "@toki/ui-web";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Providers } from "../test/providers";
import { GUARD_ESCAPE } from "./guardEscape";
import { hasFormContent } from "./formContent";
import { useFormGuard, type FormClose } from "./useFormGuard";

function FormScreen({
  initial = "",
  onClose,
}: {
  initial?: string;
  onClose: (reason: FormClose) => void;
}) {
  const [open, setOpen] = useState(true);
  const [text, setText] = useState(initial);
  const guard = useFormGuard({
    hasContent: hasFormContent({ text }),
    formName: "Create channel",
    onClose: (reason) => {
      onClose(reason);
      setOpen(false);
    },
  });
  return (
    <>
      <Modal
        open={open}
        title="Create channel"
        closeLabel="Close"
        onRequestClose={guard.onRequestClose}
        footer={<Button onClick={guard.requestClose}>Cancel form</Button>}
      >
        <div onFocusCapture={guard.trackFocus}>
          <input
            aria-label="Name"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
      </Modal>
      {guard.discardDialog}
    </>
  );
}

function setup(initial = "") {
  const onClose = vi.fn();
  const view = render(
    <Providers>
      <FormScreen initial={initial} onClose={onClose} />
    </Providers>,
  );
  return { onClose, ...view };
}

const question = () => screen.queryByText("Discard what you typed?");
const scrimOf = (title: string) =>
  screen.getByRole("dialog", { name: title }).parentElement as HTMLElement;

describe("a form with no content (R21)", () => {
  it("closes at once for Esc, an outside press and the close button", async () => {
    for (const how of ["escape", "outside", "close"] as const) {
      const user = userEvent.setup();
      const { onClose, unmount } = setup();
      if (how === "escape") await user.keyboard("{Escape}");
      if (how === "outside") await user.click(scrimOf("Create channel"));
      if (how === "close")
        await user.click(screen.getByRole("button", { name: "Close" }));
      expect(onClose).toHaveBeenCalledWith(how);
      expect(question()).toBeNull();
      unmount();
    }
  });

  it("the form's own Cancel button closes at once too", async () => {
    const { onClose } = setup();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Cancel form" }));
    expect(onClose).toHaveBeenCalledWith("close");
    expect(question()).toBeNull();
  });
});

describe("a form with content", () => {
  it("an outside press does nothing: the form, its text and its focus stay", async () => {
    const user = userEvent.setup();
    const { onClose } = setup("draft");
    const input = screen.getByRole("textbox", { name: "Name" });
    input.focus();
    await user.click(scrimOf("Create channel"));
    expect(onClose).not.toHaveBeenCalled();
    expect(question()).toBeNull();
    expect(input).toHaveValue("draft");
    expect(input).toHaveFocus();
  });

  it("the close button and the form's Cancel ask whether to discard", async () => {
    const user = userEvent.setup();
    const { onClose } = setup("draft");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(question()).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    // Keep editing, then ask again through the form's Cancel.
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(question()).toBeNull();
    await user.click(screen.getByRole("button", { name: "Cancel form" }));
    expect(question()).toBeInTheDocument();
  });

  it("Esc asks while GUARD_ESCAPE is ask", async () => {
    expect(GUARD_ESCAPE).toBe("ask");
    const user = userEvent.setup();
    const { onClose } = setup("draft");
    await user.keyboard("{Escape}");
    expect(question()).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("the question is a ConfirmDialog that names the form", async () => {
    const user = userEvent.setup();
    setup("draft");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(
      screen.getByText('What you typed in "Create channel" will be lost.'),
    ).toBeInTheDocument();
    expect(
      document.querySelectorAll("p.cfm-target strong")[0],
    ).toHaveTextContent("Create channel");
    expect(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Discard" })).toBeInTheDocument();
  });

  it("Keep editing closes the question and returns focus to the last field", async () => {
    const user = userEvent.setup();
    const { onClose } = setup("draft");
    const input = screen.getByRole("textbox", { name: "Name" });
    input.focus();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(question()).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(input).toHaveValue("draft");
    expect(input).toHaveFocus();
  });

  it("focus returns to the field also when the body had focus (the Safari case)", async () => {
    const user = userEvent.setup();
    setup("draft");
    const input = screen.getByRole("textbox", { name: "Name" });
    input.focus();
    // A mouse press on a button does not focus it in Safari: the body has focus.
    act(() => input.blur());
    expect(document.body).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(question()).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(question()).toBeNull();
    expect(input).toHaveFocus();
  });

  it("Esc and an outside press on the question keep the form and call nothing", async () => {
    const user = userEvent.setup();
    const { onClose } = setup("draft");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.keyboard("{Escape}");
    expect(question()).toBeNull();
    expect(
      screen.getByRole("dialog", { name: "Create channel" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(scrimOf("Discard what you typed?"));
    expect(question()).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Discard closes the question and calls onClose('discard') once", async () => {
    const user = userEvent.setup();
    const { onClose } = setup("draft");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith("discard");
    expect(question()).toBeNull();
  });

  it("the first Esc closes the question, not the form", async () => {
    const user = userEvent.setup();
    const { onClose } = setup("draft");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.keyboard("{Escape}");
    expect(question()).toBeNull();
    expect(
      screen.getByRole("dialog", { name: "Create channel" }),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("unmounting with the question open leaves no extra child and no inert", async () => {
    const user = userEvent.setup();
    const { unmount, container } = setup("draft");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(question()).toBeInTheDocument();
    unmount();
    // Only the container that Testing Library made is left in the body.
    expect(
      Array.from(document.body.children).filter((el) => el !== container),
    ).toEqual([]);
    expect(document.querySelector("[inert]")).toBeNull();
  });
});
