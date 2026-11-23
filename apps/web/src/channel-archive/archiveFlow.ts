// What an archive does (R9 to R11), as plain functions: they take the store commands, the toast and
// the callbacks as arguments and call no hook, so they work after the dialog has unmounted.

// The count that the confirmation names (R9). The fresh read of the press wins; a failed read falls
// back to the count the store holds; with neither there is no count and nothing may open (F26).
export async function readArchiveCount(args: {
  id: string;
  readChannel: (id: string) => Promise<{ memberCount: number }>;
  getMemberCount: (id: string) => number | undefined;
}): Promise<number | null> {
  try {
    return (await args.readChannel(args.id)).memberCount;
  } catch {
    return args.getMemberCount(args.id) ?? null;
  }
}

export type ArchiveFlowArgs = {
  id: string;
  archiveChannel: (id: string) => Promise<unknown>;
  readChannel: (id: string) => Promise<unknown>;
  // The kind of `classifyApiError` (TOKI-032 R8, D-131).
  classify: (error: unknown) => string;
  show: (toast: { text: string }) => void;
  texts: { done: string; failed: string };
  onNoAccess: () => void;
  closeDialog: () => void;
  setBusy: (busy: boolean) => void;
};

// A resolved command is a success, a repeat included (it answers 200 with `changed` false, D-111).
// The toast has no button: an action with a confirmation never also offers Undo (D-069, AC-077).
export async function archiveFlow(args: ArchiveFlowArgs): Promise<void> {
  args.setBusy(true);
  try {
    await args.archiveChannel(args.id);
    args.show({ text: args.texts.done });
    args.closeDialog();
  } catch (error) {
    const kind = args.classify(error);
    if (kind === "no_access") {
      args.closeDialog();
      args.onNoAccess();
    } else if (kind === "fresh_copy") {
      await args.readChannel(args.id).catch(() => {});
      args.closeDialog();
      args.show({ text: args.texts.failed });
    } else if (kind !== "unauthenticated" && kind !== "ignore") {
      args.show({ text: args.texts.failed });
    }
  } finally {
    args.setBusy(false);
  }
}
