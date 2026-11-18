import { useRef } from "react";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AppShell, type NavSection } from "../../src/layout/index";
import { useToastAvoid } from "../../src/components/Toast";

// R23, R25: the shell mounts the provider around everything it draws, so the
// region is the next sibling of div.app, and a component inside `main` that
// calls `useToastAvoid` moves the region.
const sections: NavSection[] = [
  { id: "home", icon: "home", label: "H", href: "/", tab: true },
];
const labels = { mainNavigation: "Main", conversations: "Convs" };
const base = { sections, currentSection: "home", labels };

type Box = { left: number; right: number; top: number; height: number };
let boxes: Record<string, Box> = {};

function setHeight(height: number) {
  Object.defineProperty(window, "innerHeight", {
    value: height,
    configurable: true,
  });
}

beforeEach(() => {
  setHeight(800);
  boxes = {};
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const key = this.dataset.box ?? this.className.split(" ")[0] ?? "";
      const b = boxes[key];
      if (!b) return new DOMRect(0, 0, 0, 0);
      return new DOMRect(b.left, b.top, b.right - b.left, b.height);
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
});

function Composer() {
  const ref = useRef<HTMLDivElement>(null);
  useToastAvoid(ref);
  return <div ref={ref} data-box="composer" />;
}

const region = (c: HTMLElement) => c.querySelector<HTMLElement>(".toasts")!;

describe("AppShell and the toasts (R23)", () => {
  test("the region is the next sibling of div.app and never inside it", () => {
    const { container } = render(<AppShell {...base}>x</AppShell>);
    expect([...container.children].map((c) => c.className)).toEqual([
      "app",
      "toasts",
    ]);
    expect(container.querySelector(".app .toasts")).toBeNull();
  });

  test("the toast anchor is the registered anchor", () => {
    boxes["toast-anchor"] = { left: 272, right: 1088, top: 12, height: 776 };
    const { container } = render(<AppShell {...base}>x</AppShell>);
    expect(region(container).style.left).toBe("680px");
    expect(region(container).style.width).toBe("480px");
  });

  test("the nav is an obstacle: it lifts the region 14 px above its top", () => {
    boxes["nav"] = { left: 0, right: 400, top: 738, height: 62 };
    boxes["toast-anchor"] = { left: 0, right: 400, top: 0, height: 800 };
    const { container } = render(<AppShell {...base}>x</AppShell>);
    expect(region(container).style.bottom).toBe("76px");
  });

  test("with nothing in the way the region is 20 px from the bottom", () => {
    const { container } = render(<AppShell {...base}>x</AppShell>);
    expect(region(container).style.bottom).toBe("20px");
  });
});

describe("a composer inside the shell (R25)", () => {
  test("a component in main that calls useToastAvoid changes the region's bottom", () => {
    boxes["toast-anchor"] = { left: 0, right: 1000, top: 0, height: 800 };
    boxes["composer"] = { left: 0, right: 1000, top: 700, height: 100 };
    const without = render(<AppShell {...base}>x</AppShell>);
    expect(region(without.container).style.bottom).toBe("20px");
    without.unmount();
    const { container } = render(
      <AppShell {...base}>
        <Composer />
      </AppShell>,
    );
    expect(region(container).style.bottom).toBe("114px");
  });

  test("so does one inside the side panel", () => {
    boxes["toast-anchor"] = { left: 0, right: 1000, top: 0, height: 800 };
    boxes["composer"] = { left: 0, right: 1000, top: 700, height: 100 };
    const { container } = render(
      <AppShell {...base} panel={<Composer />} panelLabel="P">
        x
      </AppShell>,
    );
    expect(region(container).style.bottom).toBe("114px");
  });
});
