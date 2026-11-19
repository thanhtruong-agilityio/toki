export type PaneName = "list" | "main" | "side";

// The pane that a narrow screen shows, a pure function of four inputs (R4).
export function derivePane(input: {
  section: string;
  chatOpen: boolean;
  panelOpen: boolean;
  hasList: boolean;
}): PaneName {
  if (input.panelOpen) return "side";
  if (input.section === "home" && !input.chatOpen && input.hasList)
    return "list";
  return "main";
}
