import { afterEach, describe, expect, test, vi } from "vitest";
import { createFiles } from "./files";

function input(): HTMLInputElement {
  return document.querySelector<HTMLInputElement>('input[type="file"]')!;
}

function choose(el: HTMLInputElement, files: File[]) {
  Object.defineProperty(el, "files", { configurable: true, value: files });
  el.dispatchEvent(new Event("change"));
}

function made(name: string, size: number, type = "text/plain"): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("files.pick", () => {
  test("clicks the hidden input before the first await (R13)", () => {
    const click = vi.spyOn(HTMLInputElement.prototype, "click");
    void createFiles().pick();
    expect(click).toHaveBeenCalledTimes(1);
    expect(input()).not.toBeNull();
  });

  test("resolves with the picked files, in order, as name, size, mimeType and handle (R13)", async () => {
    const a = made("a.txt", 1);
    const b = made("b.png", 2, "image/png");
    const result = createFiles().pick({ multiple: true });
    choose(input(), [a, b]);
    await expect(result).resolves.toEqual([
      { name: "a.txt", size: 1, mimeType: "text/plain", handle: a },
      { name: "b.png", size: 2, mimeType: "image/png", handle: b },
    ]);
  });

  test("handle is the browser's own File object (R13)", async () => {
    const a = made("a.txt", 1);
    const result = createFiles().pick();
    choose(input(), [a]);
    expect((await result)[0]?.handle).toBe(a);
  });

  test("multiple and accept reach the dialog; by default every type and one file (R13, R14)", () => {
    void createFiles().pick({ multiple: true, accept: ["image/*", ".pdf"] });
    expect(input().multiple).toBe(true);
    expect(input().accept).toBe("image/*,.pdf");
    void createFiles().pick();
    const second = document.querySelectorAll('input[type="file"]');
    const last = second[second.length - 1] as HTMLInputElement;
    expect(last.multiple).toBe(false);
    expect(last.hasAttribute("accept")).toBe(false);
  });

  test("a closed dialog resolves an empty list (R15)", async () => {
    const result = createFiles().pick();
    input().dispatchEvent(new Event("cancel"));
    await expect(result).resolves.toEqual([]);
  });

  test("a change with no file resolves an empty list (R15)", async () => {
    const result = createFiles().pick();
    choose(input(), []);
    await expect(result).resolves.toEqual([]);
  });

  test("a second call resolves the first with an empty list (R16)", async () => {
    const files = createFiles();
    const first = files.pick();
    const second = files.pick();
    await expect(first).resolves.toEqual([]);
    const a = made("a.txt", 1);
    const inputs = document.querySelectorAll('input[type="file"]');
    expect(inputs).toHaveLength(1);
    choose(inputs[0] as HTMLInputElement, [a]);
    await expect(second).resolves.toHaveLength(1);
  });

  test("returns a file of any size unchanged, no count check (R17)", async () => {
    const big = made("big.bin", 200 * 1024 * 1024, "");
    const result = createFiles().pick({ multiple: true });
    choose(input(), [big, big, big, big, big, big, big, big, big, big, big]);
    const picked = await result;
    expect(picked).toHaveLength(11);
    expect(picked[0]?.size).toBe(200 * 1024 * 1024);
  });

  test("leaves no element once a call has resolved (R17)", async () => {
    const result = createFiles().pick();
    choose(input(), [made("a.txt", 1)]);
    await result;
    expect(input()).toBeNull();
    const cancelled = createFiles().pick();
    input().dispatchEvent(new Event("cancel"));
    await cancelled;
    expect(input()).toBeNull();
  });

  test("a call with no change or cancel stays unanswered and leaves its input (R16, R17)", async () => {
    let settled = false;
    void createFiles()
      .pick()
      .then(() => (settled = true));
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(settled).toBe(false);
    expect(input()).not.toBeNull();
  });

  test("never rejects when the input cannot be clicked (R15)", async () => {
    vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {
      throw new Error("no");
    });
    await expect(createFiles().pick()).resolves.toEqual([]);
    expect(input()).toBeNull();
  });
});
