import { useRef, useState, type ReactNode } from "react";
import type { Example } from "../../internal/example";
import { Button } from "../Button/Button";
import { Modal } from "./Modal";

type Demo = {
  openLabel: string;
  // Closes on every reason, so that Esc closes it (R30); `opaque` and
  // `no-close` ignore Esc and outside presses on purpose and hold a button.
  ignoreRequests?: boolean;
  render: (api: {
    open: boolean;
    close: () => void;
    onRequestClose: () => void;
    returnFocusRef: React.RefObject<HTMLButtonElement | null>;
  }) => ReactNode;
};

function OpenDemo({ openLabel, ignoreRequests, render }: Demo) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);
  return (
    <>
      <Button ref={opener} onClick={() => setOpen(true)}>
        {openLabel}
      </Button>
      {render({
        open,
        close,
        onRequestClose: ignoreRequests ? () => {} : close,
        returnFocusRef: opener,
      })}
    </>
  );
}

export const examples: Example[] = [
  {
    id: "with-footer",
    title: "title, close button, body and footer",
    element: (
      <OpenDemo
        openLabel="Open"
        render={({ open, close, onRequestClose, returnFocusRef }) => (
          <Modal
            open={open}
            title="Demo title"
            closeLabel="Close"
            backdrop="dim"
            returnFocusRef={returnFocusRef}
            onRequestClose={onRequestClose}
            footer={
              <>
                <Button onClick={close}>Cancel</Button>
                <Button variant="primary" onClick={close}>
                  Save
                </Button>
              </>
            }
          >
            <p>Demo body text.</p>
          </Modal>
        )}
      />
    ),
  },
  {
    id: "no-footer",
    title: "title, close button and body",
    element: (
      <OpenDemo
        openLabel="Open"
        render={({ open, onRequestClose, returnFocusRef }) => (
          <Modal
            open={open}
            title="Demo title"
            closeLabel="Close"
            returnFocusRef={returnFocusRef}
            onRequestClose={onRequestClose}
          >
            <p>Demo body text.</p>
          </Modal>
        )}
      />
    ),
  },
  {
    id: "label-only",
    title: "named by aria-label, no header",
    element: (
      <OpenDemo
        openLabel="Open"
        render={({ open, onRequestClose, returnFocusRef }) => (
          <Modal
            open={open}
            aria-label="Demo palette"
            returnFocusRef={returnFocusRef}
            onRequestClose={onRequestClose}
          >
            <input aria-label="Demo search" data-autofocus />
          </Modal>
        )}
      />
    ),
  },
  {
    id: "opaque",
    title: "opaque backdrop",
    element: (
      <OpenDemo
        openLabel="Open"
        ignoreRequests
        render={({ open, close, onRequestClose, returnFocusRef }) => (
          <Modal
            open={open}
            title="Demo title"
            backdrop="opaque"
            returnFocusRef={returnFocusRef}
            onRequestClose={onRequestClose}
            footer={<Button onClick={close}>Done</Button>}
          >
            <p>The page behind is covered.</p>
          </Modal>
        )}
      />
    ),
  },
  {
    id: "no-close",
    title: "no close button",
    element: (
      <OpenDemo
        openLabel="Open"
        ignoreRequests
        render={({ open, close, onRequestClose, returnFocusRef }) => (
          <Modal
            open={open}
            title="Demo title"
            returnFocusRef={returnFocusRef}
            onRequestClose={onRequestClose}
          >
            <p>This dialog is closed by its button.</p>
            <Button onClick={close}>Done</Button>
          </Modal>
        )}
      />
    ),
  },
];
