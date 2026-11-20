// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CreateChannelButton } from "../../../src/features/create-channel/CreateChannelButton";
import { useCreateChannelDialog } from "../../../src/features/create-channel/useCreateChannelDialog";
import { setConnectionCheck } from "../../../src/patterns/online";
import { Providers } from "../../support/providers";
import { change, fake, resetFake } from "./fakeDeps";

vi.mock("../../../src/features/create-channel/deps", async () =>
  (await import("./fakeDeps")).makeDepsMock(),
);

beforeEach(resetFake);
afterEach(() => setConnectionCheck(null));

const plus = () => screen.queryByRole("button", { name: "Create channel" });
const dialog = () => screen.queryByRole("dialog", { name: "Create channel" });

function mountButton(onCreated?: (id: string) => void) {
  const user = userEvent.setup();
  const view = render(
    <Providers>
      <CreateChannelButton onCreated={onCreated} />
    </Providers>,
  );
  return { user, ...view };
}

describe("CreateChannelButton (R4)", () => {
  test("an Admin presses the button and finds the dialog; Esc returns focus to the button", async () => {
    const { user } = mountButton();
    expect(dialog()).toBeNull();
    await user.click(plus()!);
    expect(dialog()).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(dialog()).toBeNull();
    expect(plus()).toHaveFocus();
  });

  test("the button is a small icon button named by the key", () => {
    mountButton();
    expect(plus()).toHaveClass("ib", "sm");
    expect(plus()!.tagName).toBe("BUTTON");
  });

  test.each<["member" | null]>([["member"], [null]])(
    "the role %s: no button, no dialog",
    (role) => {
      fake.role = role;
      mountButton();
      expect(plus()).toBeNull();
      expect(dialog()).toBeNull();
      expect(screen.queryAllByRole("button")).toHaveLength(0);
      expect(fake.createChannel).not.toHaveBeenCalled();
    },
  );

  test("a role that changes from admin to member while the dialog is open removes both and sends nothing", async () => {
    const { user } = mountButton();
    await user.click(plus()!);
    act(() => change(() => (fake.role = "member")));
    expect(plus()).toBeNull();
    expect(dialog()).toBeNull();
    expect(fake.createChannel).not.toHaveBeenCalled();
    // and when the role comes back the dialog is not open
    act(() => change(() => (fake.role = "admin")));
    expect(dialog()).toBeNull();
  });

  test("a created channel calls onCreated, closes, and opens /c/{id}", async () => {
    const onCreated = vi.fn();
    const { user } = mountButton(onCreated);
    await user.click(plus()!);
    await user.type(screen.getByRole("textbox", { name: "Name" }), "qa");
    await user.click(screen.getByRole("button", { name: "Create" }));
    const id = (fake.createChannel.mock.calls[0]![0] as { id: string }).id;
    expect(onCreated).toHaveBeenCalledWith(id);
    expect(fake.opened).toHaveBeenCalledWith(id);
    expect(dialog()).toBeNull();
  });
});

function Screen({
  onCreated,
  showElement,
  returnFocus = true,
}: {
  onCreated: (id: string) => void;
  showElement: boolean;
  returnFocus?: boolean;
}) {
  const { open, element } = useCreateChannelDialog({ onCreated });
  const [ref, setRef] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <button
        type="button"
        ref={setRef}
        onClick={() =>
          open(returnFocus ? { returnFocusRef: { current: ref } } : undefined)
        }
      >
        own opener
      </button>
      <button type="button" onClick={() => open()}>
        no ref
      </button>
      {showElement ? element : null}
    </>
  );
}

describe("useCreateChannelDialog (R4, R12)", () => {
  async function createFromScreen(showElement: boolean) {
    const onCreated = vi.fn();
    const user = userEvent.setup();
    let release!: (value: { id: string; created: boolean }) => void;
    fake.createChannel.mockImplementation(
      () => new Promise((resolve) => (release = resolve)),
    );
    const view = render(
      <Providers>
        <Screen onCreated={onCreated} showElement={showElement} />
      </Providers>,
    );
    await user.click(screen.getByRole("button", { name: "own opener" }));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "qa");
    await user.click(screen.getByRole("button", { name: "Create" }));
    return {
      onCreated,
      user,
      view,
      answer: () => act(async () => release({ id: "made", created: true })),
    };
  }

  test("returns open and an element, and the element is the dialog", async () => {
    const { user } = { user: userEvent.setup() };
    render(
      <Providers>
        <Screen onCreated={() => {}} showElement />
      </Providers>,
    );
    expect(dialog()).toBeNull();
    await user.click(screen.getByRole("button", { name: "own opener" }));
    expect(dialog()).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "own opener" })).toHaveFocus();
  });

  test("open does nothing for a role that is not admin", async () => {
    fake.role = "member";
    const user = userEvent.setup();
    render(
      <Providers>
        <Screen onCreated={() => {}} showElement />
      </Providers>,
    );
    await user.click(screen.getByRole("button", { name: "no ref" }));
    expect(dialog()).toBeNull();
  });

  test("the dialog unmounted first, the screen still mounted: only onCreated", async () => {
    const { onCreated, view, answer } = await createFromScreen(true);
    view.rerender(
      <Providers>
        <Screen onCreated={onCreated} showElement={false} />
      </Providers>,
    );
    await answer();
    expect(onCreated).toHaveBeenCalledWith("made");
    expect(fake.opened).not.toHaveBeenCalled();
  });

  test("the screen unmounted too: no call at all", async () => {
    const { onCreated, view, answer } = await createFromScreen(true);
    view.unmount();
    await answer();
    expect(onCreated).not.toHaveBeenCalled();
    expect(fake.opened).not.toHaveBeenCalled();
  });
});
