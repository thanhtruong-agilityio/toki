import {
  AppShell,
  Avatar,
  Button,
  EmptyState,
  IconButton,
  SectionPage,
  SidePanel,
  Tab,
  TabList,
  useNarrow,
  useToastAvoid,
  useToasts,
  type NavSection,
} from "@toki/ui-web";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { visibleSections, type Role, type SectionRow } from "../shell/sections";

// The fixture's section list: the six sections of phase 1 and Preferences, in
// the order of R30. Made-up labels; the `labelKey` is not used here.
const rows: SectionRow[] = [
  row("home", "home", true),
  row("activity", "bell", true),
  row("later", "bookmark", true),
  row("files", "folder", true),
  row("people", "users"),
  { ...row("admin", "shield"), roles: ["admin"] },
  { ...row("preferences", "settings"), calmHidden: true, more: true },
];

function row(id: string, icon: SectionRow["icon"], tab = false): SectionRow {
  return {
    id,
    icon,
    labelKey: "nav.home",
    to: `#${id}`,
    match: () => false,
    tab,
  };
}

const LABELS: Record<string, string> = {
  home: "Home",
  activity: "Activity",
  later: "Later",
  files: "Files",
  people: "People",
  admin: "Admin",
  preferences: "Preferences",
  extra1: "Extra one",
  extra2: "Extra two",
};

const PEOPLE = [
  "Mira Okafor",
  "Tomas Lindqvist",
  "Ayaka Fujimoto",
  "Dara Nwosu",
  "Elio Marchetti",
  "Priya Raman",
  "Jonas Beck",
  "Sana Haddad",
];

const LONG_TOAST =
  "A made-up message that is long enough to fill the whole width of the toast region and wrap over several lines, so that the box is as tall as a toast gets.";

// The stand-in composer of R25: it calls `useToastAvoid` on its outermost
// element, the way TOKI-043 does.
function Composer({ testId }: { testId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useToastAvoid(ref);
  return (
    <div
      ref={ref}
      data-testid={testId}
      className="row"
      style={{ padding: 12, borderTop: "1px solid var(--line)" }}
    >
      <input
        aria-label="Message"
        placeholder="Write something"
        style={{ flex: 1, minWidth: 0, height: 40, padding: "0 10px" }}
      />
      <Button variant="primary">Send</Button>
    </div>
  );
}

// Shows three toasts at once (`?toasts=1`), one of them long.
function ToastDemo({ enabled }: { enabled: boolean }) {
  const toasts = useToasts();
  useEffect(() => {
    if (!enabled) return;
    toasts.show({ text: "Saved" });
    toasts.show({
      text: "Link copied",
      action: { label: "Undo", onPress() {} },
    });
    toasts.show({ text: LONG_TOAST });
  }, [enabled, toasts]);
  return null;
}

function Empty({ title }: { title: string }) {
  return (
    <EmptyState
      icon="bell"
      title={title}
      description="Nothing here yet, and this text is made up."
    />
  );
}

export function Fixture({ params }: { params: URLSearchParams }) {
  const narrow = useNarrow();
  const pane = params.get("pane");
  const empty = params.get("empty");
  const role: Role = params.get("role") === "member" ? "member" : "admin";
  const extra = Math.min(2, Math.max(0, Number(params.get("extra")) || 0));

  const [section, setSection] = useState(params.get("section") ?? "home");
  const [chatOpen, setChatOpen] = useState(pane === "main");
  const [panelOpen, setPanelOpen] = useState(
    params.get("panel") === "1" || pane === "side",
  );
  const [tab, setTab] = useState("chat");
  const [moreOpen, setMoreOpen] = useState(false);

  const visible = visibleSections(role, rows);
  const extras: SectionRow[] = [row("extra1", "star"), row("extra2", "hash")];
  const all = [...visible, ...extras.slice(0, extra)];
  const sections: NavSection[] = all.map((item) => ({
    id: item.id,
    icon: item.icon,
    label: LABELS[item.id] ?? item.id,
    href: item.to,
    tab: item.tab,
    more: item.more,
    calmHidden: item.calmHidden,
    badge: item.id === "home" ? 3 : item.id === "activity" ? 12 : undefined,
  }));

  const list = (
    <>
      <div className="sh">
        <h2 className="ell">Conversations</h2>
      </div>
      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        {Array.from({ length: 40 }, (_, i) => {
          const name = PEOPLE[i % PEOPLE.length]!;
          return (
            <button
              key={i}
              type="button"
              className="crow"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "8px 16px",
              }}
              onClick={() => {
                setSection("home");
                setChatOpen(true);
              }}
            >
              <Avatar name={name} hue={(i * 47) % 360} />
              <span className="grow">
                <b className="ell" style={{ display: "block" }}>
                  {name}
                </b>
                <span className="muted xs ell" style={{ display: "block" }}>
                  Made-up preview of message {i + 1}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );

  const chat = (
    <>
      <div className="sh">
        {narrow && (
          <IconButton
            icon="left"
            label="Back to the list"
            onClick={() => setChatOpen(false)}
          />
        )}
        <h2 className="ell">Design review</h2>
        <IconButton
          icon="more"
          label="Details"
          onClick={() => setPanelOpen(true)}
        />
      </div>
      <TabList aria-label="Views">
        {[
          ["chat", "Chat"],
          ["files", "Files"],
          ["pins", "Pins"],
        ].map(([id, text]) => (
          <Tab
            key={id}
            id={`tab-${id}`}
            selected={tab === id}
            onSelect={() => setTab(id!)}
          >
            {text}
          </Tab>
        ))}
      </TabList>
      <div className="scroll" style={{ flex: 1, minHeight: 0, padding: 16 }}>
        {Array.from({ length: 30 }, (_, i) => (
          <p key={i} style={{ margin: "0 0 10px" }}>
            Made-up message {i + 1} in the design review thread.
          </p>
        ))}
      </div>
      <Composer testId="composer" />
    </>
  );

  const page = (
    <SectionPage
      title={LABELS[section] ?? section}
      actions={<Button>Mark all read</Button>}
    >
      {empty === "secbody" ? (
        <Empty title="No items" />
      ) : (
        Array.from({ length: 30 }, (_, i) => (
          <p key={i} style={{ margin: "0 0 10px" }}>
            Made-up item {i + 1} of the {LABELS[section] ?? section} section.
          </p>
        ))
      )}
    </SectionPage>
  );

  let main: ReactNode;
  if (empty === "main") main = <Empty title="Pick a conversation" />;
  else main = section === "home" ? chat : page;

  const panel = panelOpen ? (
    <>
      <SidePanel
        title="Details"
        subtitle="8 people"
        labels={{ back: "Back", close: "Close" }}
        onClose={() => setPanelOpen(false)}
      >
        {empty === "sb" ? (
          <Empty title="No details" />
        ) : (
          PEOPLE.map((name, i) => (
            <div key={name} className="row" style={{ marginBottom: 10 }}>
              <Avatar name={name} hue={(i * 47) % 360} />
              <span>{name}</span>
            </div>
          ))
        )}
      </SidePanel>
      <Composer testId="panel-composer" />
    </>
  ) : undefined;

  return (
    <AppShell
      sections={sections}
      currentSection={section}
      onNavigate={(next) => {
        setSection(next.id);
        setPanelOpen(false);
      }}
      labels={{ mainNavigation: "Main", conversations: "Conversations" }}
      workspace={{ name: "Harbour Studio", detail: "8 people" }}
      search={{ label: "Search", hint: "Ctrl K", onOpen() {} }}
      account={{
        label: "Account menu",
        name: PEOPLE[0]!,
        hue: 200,
        presence: "active",
        presenceLabel: "Active",
        detail: "Active",
        triggerProps: {},
      }}
      list={list}
      chatOpen={chatOpen}
      moreTab={{
        label: "More",
        open: moreOpen,
        onOpen: () => setMoreOpen((open) => !open),
      }}
      panel={panel}
      panelLabel="Details"
    >
      <ToastDemo enabled={params.get("toasts") === "1"} />
      {main}
    </AppShell>
  );
}
