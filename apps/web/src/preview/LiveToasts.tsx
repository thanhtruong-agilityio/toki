import { useToasts } from "@toki/ui-web";
import { useState } from "react";

// Three native buttons that call useToasts().show, and a counter that the
// action of the toast adds one to (R12).
export function LiveToasts() {
  const toasts = useToasts();
  const [undone, setUndone] = useState(0);
  return (
    <section className="pv-section" data-section="live-toasts">
      <h2 className="pv-heading">Live toasts</h2>
      <div className="pv-toast-buttons">
        <button
          type="button"
          className="pv-button"
          onClick={() => toasts.show({ text: "Saved a draft" })}
        >
          Show a toast
        </button>
        <button
          type="button"
          className="pv-button"
          onClick={() =>
            toasts.show({
              text: "Message deleted",
              action: { label: "Undo", onPress: () => setUndone((n) => n + 1) },
            })
          }
        >
          Show a toast with an action
        </button>
        <button
          type="button"
          className="pv-button"
          onClick={() => {
            toasts.show({ text: "First toast" });
            toasts.show({ text: "Second toast" });
            toasts.show({ text: "Third toast" });
          }}
        >
          Show three toasts
        </button>
      </div>
      <p className="pv-counter" data-toast-counter="">
        Undo presses: {undone}
      </p>
    </section>
  );
}
