import { useEffect, useRef, useState } from "react";
import type { Example } from "../../internal/example";
import { Button } from "../Button/Button";
import { ConfirmDialog, type ConfirmDialogProps } from "./ConfirmDialog";

type Demo = Pick<
  ConfirmDialogProps,
  "title" | "description" | "target" | "confirmLabel" | "variant"
> & { openLabel: string; busyFor?: number };

// The owner closes the dialog on every reason. The `busy` demo is busy for a
// moment after it opens, so that the busy look can be seen and the demo can
// still be left.
function OpenDemo({ openLabel, busyFor, ...dialog }: Demo) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || busyFor === undefined) return;
    setBusy(true);
    const id = setTimeout(() => setBusy(false), busyFor);
    return () => clearTimeout(id);
  }, [open, busyFor]);

  return (
    <>
      <Button ref={opener} onClick={() => setOpen(true)}>
        {openLabel}
      </Button>
      <ConfirmDialog
        {...dialog}
        cancelLabel="Cancel"
        open={open}
        busy={busy}
        returnFocusRef={opener}
        onConfirm={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

export const examples: Example[] = [
  {
    id: "delete-message",
    title: "danger, the prototype's own words for deleting a message",
    element: (
      <OpenDemo
        openLabel="Delete a message"
        title="Delete this message?"
        target="Lan's message"
        confirmLabel="Delete"
      />
    ),
  },
  {
    id: "archive-channel",
    title: "danger, the description names a channel and its member count",
    element: (
      <OpenDemo
        openLabel="Archive a channel"
        title="Archive this channel?"
        description="It has 24 members. It will be read-only for everyone."
        target="#design"
        confirmLabel="Archive"
      />
    ),
  },
  {
    id: "notify-channel",
    title: "primary",
    element: (
      <OpenDemo
        openLabel="Notify a channel"
        title="Notify everyone?"
        description="This sends a notification to 42 people."
        target="#general"
        confirmLabel="Notify 42 people"
        variant="primary"
      />
    ),
  },
  {
    id: "busy",
    title: "busy: both buttons are disabled while the request runs",
    element: (
      <OpenDemo
        openLabel="Delete, busy"
        title="Delete this message?"
        target="Lan's message"
        confirmLabel="Delete"
        busyFor={3000}
      />
    ),
  },
  {
    id: "long-target",
    title: "a target of 120 characters wraps without overflowing",
    element: (
      <OpenDemo
        openLabel="Long target"
        title="Delete this file?"
        target={"quarterly-planning-notes-".repeat(5).slice(0, 120)}
        confirmLabel="Delete"
      />
    ),
  },
];
