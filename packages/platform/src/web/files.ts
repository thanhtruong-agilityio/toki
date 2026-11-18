import type { PickedFile, Platform } from "../types";

export function createFiles(): Platform["files"] {
  // The call still waiting for the dialog, if any.
  let pending: (() => void) | undefined;

  return {
    // Not async on purpose: input.click() must run before the first await, or
    // the browser may refuse to open the dialog (spec, file picking).
    pick(options = {}) {
      pending?.();
      return new Promise<PickedFile[]>((resolve) => {
        const el = document.createElement("input");
        el.type = "file";
        el.hidden = true;
        el.multiple = options.multiple === true;
        if (options.accept && options.accept.length > 0) {
          el.accept = options.accept.join(",");
        }

        const finish = (files: PickedFile[]) => {
          el.remove();
          if (pending === release) pending = undefined;
          resolve(files);
        };
        const release = () => finish([]);
        pending = release;

        el.addEventListener("change", () => {
          finish(
            Array.from(el.files ?? [], (file) => ({
              name: file.name,
              size: file.size,
              mimeType: file.type,
              handle: file,
            })),
          );
        });
        el.addEventListener("cancel", release);

        document.body.append(el);
        try {
          el.click();
        } catch {
          release();
        }
      });
    },
  };
}
