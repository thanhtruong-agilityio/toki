// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ExampleFigure } from "../../src/preview/ExampleFigure";

// R7: a figure that throws shows its message and the rest of the page still
// renders. The setup file of ui-web is that package's, so this file does what
// it does: the act flag and the cleanup.
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Boom(): never {
  throw new Error("the example broke");
}

describe("ExampleFigure (R6, R7)", () => {
  // React logs the caught error; silence it for the render that throws.
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  test("a working example is a figure with its id, caption and no failure mark", () => {
    const { container } = render(
      <ExampleFigure
        component="Button"
        example={{ id: "plain", title: "the plain one", element: <b>ok</b> }}
      />,
    );
    const figure = container.querySelector("figure")!;
    expect(figure.getAttribute("data-example")).toBe("Button/plain");
    expect(figure.hasAttribute("data-failed")).toBe(false);
    expect(figure.querySelector("figcaption")?.textContent).toBe(
      "the plain one",
    );
    expect(figure.querySelector("b")?.textContent).toBe("ok");
  });

  test("a throwing example shows the message and carries data-failed", () => {
    const { container } = render(
      <ExampleFigure
        component="Button"
        example={{ id: "bad", title: "the bad one", element: <Boom /> }}
      />,
    );
    const figure = container.querySelector("figure")!;
    expect(figure.getAttribute("data-failed")).toBe("true");
    expect(figure.textContent).toContain("the example broke");
    expect(figure.querySelector("figcaption")?.textContent).toBe("the bad one");
  });

  test("the other figures still render", () => {
    const { container } = render(
      <div>
        <ExampleFigure
          component="Button"
          example={{ id: "bad", title: "bad", element: <Boom /> }}
        />
        <ExampleFigure
          component="Button"
          example={{ id: "good", title: "good", element: <i>fine</i> }}
        />
      </div>,
    );
    expect(container.querySelectorAll("figure")).toHaveLength(2);
    expect(container.querySelectorAll("[data-failed]")).toHaveLength(1);
    expect(container.querySelector("i")?.textContent).toBe("fine");
  });
});
