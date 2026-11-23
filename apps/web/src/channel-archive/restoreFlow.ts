// What a confirmed restore does (R19), as a plain function with the shape of `archiveFlow`: it calls
// no hook, so it works after the dialog has unmounted.
export type RestoreFlowArgs = {
  id: string;
  restoreChannel: (id: string) => Promise<unknown>;
  // The kind of `classifyApiError` (TOKI-032 R8, D-131).
  classify: (error: unknown) => string;
  show: (toast: { text: string }) => void;
  texts: { restored: string; failed: string };
  // The dialog's reset of its list, so the row shows what the server says (R20).
  onChanged: () => void;
  closeDialog: () => void;
  setBusy: (busy: boolean) => void;
};

// A resolved command is a success: the store's command does not reject when its refresh fails
// (TOKI-032 R15). The toast has no button: an Undo would run `archiveChannel` with no question.
export async function restoreFlow(args: RestoreFlowArgs): Promise<void> {
  args.setBusy(true);
  try {
    await args.restoreChannel(args.id);
    args.show({ text: args.texts.restored });
    args.closeDialog();
    args.onChanged();
  } catch (error) {
    const kind = args.classify(error);
    if (kind === "fresh_copy" || kind === "no_access") {
      args.closeDialog();
      args.show({ text: args.texts.failed });
      args.onChanged();
    } else if (kind !== "unauthenticated" && kind !== "ignore") {
      args.show({ text: args.texts.failed });
    }
  } finally {
    args.setBusy(false);
  }
}
