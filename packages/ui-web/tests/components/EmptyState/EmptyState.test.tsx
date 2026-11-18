import { render, screen } from "@testing-library/react";
import { resolve } from "node:path";
import { createRef } from "react";
import { describe, expect, test } from "vitest";
import { expectCssTable } from "../../support/css-table";
import { EmptyState } from "../../../src/components/EmptyState/EmptyState";

// The folder this file sat in before the tests moved to tests/: its relative paths still start here.
const SRC_DIR = `${import.meta.dirname}/../../../src/components/EmptyState`;

describe("EmptyState (R15, R18)", () => {
  test("renders div.empty with the icon, the title, the description in that order", () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(
      <EmptyState
        ref={ref}
        icon="users"
        title="Nobody matches"
        description="Try a name or a job title."
      />,
    );
    const empty = container.firstElementChild as HTMLElement;
    expect(empty.tagName).toBe("DIV");
    expect(empty.className).toBe("empty");
    expect(ref.current).toBe(empty);
    expect(empty.children).toHaveLength(3);
    const [eic, title, description] = Array.from(empty.children);
    expect(eic!.tagName).toBe("DIV");
    expect(eic!.className).toBe("eic");
    const svg = eic!.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("26");
    expect(svg.getAttribute("height")).toBe("26");
    expect(title!.tagName).toBe("B");
    expect(title!.textContent).toBe("Nobody matches");
    expect(description!.tagName).toBe("SPAN");
    expect(description!.textContent).toBe("Try a name or a job title.");
  });

  test("without an action nothing follows the description", () => {
    const { container } = render(
      <EmptyState icon="users" title="t" description="d" />,
    );
    expect(container.firstElementChild!.children).toHaveLength(3);
  });

  test("an action node comes last", () => {
    const { container } = render(
      <EmptyState
        icon="users"
        title="t"
        description="d"
        action={<button type="button">Open</button>}
      />,
    );
    const empty = container.firstElementChild!;
    expect(empty.children).toHaveLength(4);
    expect(empty.lastElementChild).toBe(screen.getByRole("button"));
  });

  test("it holds no text of its own and draws no button of its own (R3)", () => {
    const { container } = render(
      <EmptyState icon="users" title="" description="" />,
    );
    expect(container.textContent).toBe("");
    expect(container.querySelector("button")).toBeNull();
  });

  test("className is appended and other attributes go through", () => {
    const { container } = render(
      <EmptyState
        icon="users"
        title="t"
        description="d"
        className="mine"
        data-x="1"
      />,
    );
    const empty = container.firstElementChild!;
    expect(empty.className).toBe("empty mine");
    expect(empty.getAttribute("data-x")).toBe("1");
  });

  test("children are not a prop, and are dropped when cast in; the title attribute is never set", () => {
    const extra = { children: "x" } as unknown as object;
    const { container } = render(
      <EmptyState icon="users" title="Real" description="d" {...extra} />,
    );
    const empty = container.firstElementChild!;
    expect(empty.hasAttribute("title")).toBe(false);
    expect(empty.querySelector("b")!.textContent).toBe("Real");
    expect(empty.textContent).toBe("Reald");
  });

  test("the props type: icon, title and description are required; children and role are not accepted", () => {
    // @ts-expect-error icon is required
    render(<EmptyState title="t" description="d" />);
    // @ts-expect-error title is required
    render(<EmptyState icon="users" description="d" />);
    // @ts-expect-error description is required
    render(<EmptyState icon="users" title="t" />);
    // @ts-expect-error the icon must be an IconName
    render(<EmptyState icon="no-such-icon" title="t" description="d" />);
    // @ts-expect-error role is owned
    render(<EmptyState icon="users" title="t" description="d" role="alert" />);
  });
});

describe("EmptyState filtered (R15, concern 11)", () => {
  test("filtered gives role status", () => {
    const { container } = render(
      <EmptyState icon="users" title="t" description="d" filtered />,
    );
    expect(container.firstElementChild!.getAttribute("role")).toBe("status");
  });

  test("without filtered there is no role", () => {
    const { container } = render(
      <EmptyState icon="users" title="t" description="d" />,
    );
    expect(container.firstElementChild!.hasAttribute("role")).toBe(false);
    const { container: c2 } = render(
      <EmptyState icon="users" title="t" description="d" filtered={false} />,
    );
    expect(c2.firstElementChild!.hasAttribute("role")).toBe(false);
  });

  test("a caller's role is dropped, even with a cast", () => {
    const extra = { role: "alert" } as unknown as object;
    const { container } = render(
      <EmptyState icon="users" title="t" description="d" {...extra} />,
    );
    expect(container.firstElementChild!.hasAttribute("role")).toBe(false);
    const { container: c2 } = render(
      <EmptyState icon="users" title="t" description="d" filtered {...extra} />,
    );
    expect(c2.firstElementChild!.getAttribute("role")).toBe("status");
  });

  test("the title stays a b and is not a heading", () => {
    render(<EmptyState icon="users" title="t" description="d" filtered />);
    expect(screen.queryByRole("heading")).toBeNull();
  });
});

describe("EmptyState.css (R16)", () => {
  test("holds the rules of the spec", () => {
    expectCssTable(resolve(SRC_DIR, "EmptyState.css"), [
      [
        ".empty",
        "display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:10px; padding:56px 24px; color:var(--muted); flex:1",
      ],
      [
        ".empty .eic",
        "width:56px; height:56px; border-radius:18px; background:var(--accent-soft); color:var(--accent-text); display:grid; place-items:center",
      ],
      [".empty .eic .ic", "width:26px; height:26px"],
      [".empty b", "color:var(--ink); font-size:15px"],
    ]);
  });
});
