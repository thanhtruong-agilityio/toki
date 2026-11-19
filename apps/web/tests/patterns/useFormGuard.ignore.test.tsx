// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "@toki/ui-web";
import { describe, expect, it, vi } from "vitest";
import { Providers } from "../support/providers";
import { useFormGuard } from "../../src/patterns/useFormGuard";

// The proposal of concern 1 lives in one constant; this is the other value.
vi.mock("../../src/patterns/guardEscape", () => ({ GUARD_ESCAPE: "ignore" }));

function Screen({ onClose }: { onClose: () => void }) {
  const guard = useFormGuard({ hasContent: true, formName: "Form", onClose });
  return (
    <>
      <Modal open title="Form" onRequestClose={guard.onRequestClose}>
        <input aria-label="Name" />
      </Modal>
      {guard.discardDialog}
    </>
  );
}

describe("GUARD_ESCAPE is ignore", () => {
  it("Esc on a form with content does nothing", async () => {
    const onClose = vi.fn();
    render(
      <Providers>
        <Screen onClose={onClose} />
      </Providers>,
    );
    await userEvent.setup().keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText("Discard what you typed?")).toBeNull();
    expect(screen.getByRole("dialog", { name: "Form" })).toBeInTheDocument();
  });
});
