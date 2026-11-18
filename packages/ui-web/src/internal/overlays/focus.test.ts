import { afterEach, describe, expect, test } from "vitest";
import { canFocus, firstTabbable, focusElement, tabbables } from "./focus";

function mount(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

const ids = (list: HTMLElement[]) => list.map((e) => e.id);

afterEach(() => {
  document.body.innerHTML = "";
});

describe("tabbable elements (R12)", () => {
  test("finds the kinds of the spec in document order", () => {
    const root = mount(`
      <a id="link" href="#x">a</a>
      <a id="nolink">a</a>
      <button id="btn">b</button>
      <button id="dis" disabled>b</button>
      <input id="in" />
      <input id="hid" type="hidden" />
      <select id="sel"></select>
      <textarea id="ta"></textarea>
      <details><summary id="sum1">s</summary><summary id="sum2">s</summary></details>
      <audio id="au" controls></audio><audio id="au2"></audio>
      <video id="vid" controls></video>
      <div id="ce" contenteditable="true"></div>
      <div id="cef" contenteditable="false"></div>
      <div id="ti0" tabindex="0"></div>
      <div id="ti-1" tabindex="-1"></div>
      <div id="ti3" tabindex="3"></div>
      <button id="btnm" tabindex="-1">b</button>`);
    expect(ids(tabbables(root))).toEqual([
      "link",
      "btn",
      "in",
      "sel",
      "ta",
      "sum1",
      "au",
      "vid",
      "ce",
      "ti0",
      "ti3",
    ]);
  });

  test("skips hidden, inert and a disabled fieldset, except in its first legend", () => {
    const root = mount(`
      <button id="h" hidden>b</button>
      <div hidden><button id="hp">b</button></div>
      <div inert><button id="ip">b</button></div>
      <fieldset disabled>
        <legend><button id="leg">b</button></legend>
        <legend><button id="leg2">b</button></legend>
        <button id="fs">b</button>
      </fieldset>
      <fieldset><button id="ok">b</button></fieldset>`);
    expect(ids(tabbables(root))).toEqual(["leg", "ok"]);
  });

  test("a radio group has one stop: the checked one, or the first", () => {
    const root = mount(`
      <input type="radio" name="g" id="r1" />
      <input type="radio" name="g" id="r2" checked />
      <input type="radio" name="g" id="r3" />
      <input type="radio" name="h" id="s1" />
      <input type="radio" name="h" id="s2" />`);
    expect(ids(tabbables(root))).toEqual(["r2", "s1"]);
  });

  test("firstTabbable returns the first or null", () => {
    const root = mount(`<span></span><button id="b">b</button>`);
    expect(firstTabbable(root)?.id).toBe("b");
    expect(firstTabbable(mount("<span></span>"))).toBeNull();
  });
});

describe("canFocus and focusElement (R13, R22)", () => {
  test("a connected, visible element can take focus", () => {
    const root = mount(`<button id="b">b</button>`);
    expect(canFocus(root.querySelector("#b") as HTMLElement)).toBe(true);
  });

  test("not when removed, visibility hidden, or display none on it or an ancestor", () => {
    const root = mount(`
      <button id="v" style="visibility:hidden">b</button>
      <div style="display:none"><button id="d">b</button></div>
      <div style="visibility:hidden"><button id="inh">b</button></div>`);
    for (const id of ["v", "d", "inh"])
      expect(canFocus(root.querySelector(`#${id}`) as HTMLElement), id).toBe(
        false,
      );
    const gone = document.createElement("button");
    expect(canFocus(gone)).toBe(false);
  });

  test("focusElement gives focus and says so; it gives none to a hidden element", () => {
    const root = mount(
      `<button id="b">b</button><button id="v" style="visibility:hidden">b</button>`,
    );
    const b = root.querySelector("#b") as HTMLElement;
    expect(focusElement(b)).toBe(true);
    expect(document.activeElement).toBe(b);
    expect(focusElement(root.querySelector("#v") as HTMLElement)).toBe(false);
    expect(document.activeElement).toBe(b);
    expect(focusElement(null)).toBe(false);
  });
});
