import {
  forwardRef,
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type ForwardedRef,
  type ReactNode,
} from "react";
import {
  ToastProvider,
  useToastAnchor,
  useToastAvoid,
} from "../components/Toast";
import { cx } from "../internal/cx";
import { BottomTabs, type MoreTab } from "./BottomTabs";
import { derivePane } from "./derivePane";
import { NavItem, type NavigateHandler, type NavSection } from "./NavSection";
import { SearchBox, type SearchBoxProps } from "./SearchBox";
import { useNarrow } from "./useNarrow";
import { UserCard, type UserCardAccount } from "./UserCard";
import { WorkspaceHeader } from "./WorkspaceHeader";
import "./shell.css";

type Owned = "children" | "role" | "data-testid";

type PanelProps =
  | { panel?: undefined; panelLabel?: string }
  // `panelLabel` is required when `panel` is given (R3).
  | { panel: ReactNode; panelLabel: string };

export type AppShellProps = Omit<ComponentPropsWithoutRef<"div">, Owned> & {
  sections: NavSection[];
  currentSection: string;
  onNavigate?: NavigateHandler;
  // Already translated; the shell holds no text (R2).
  labels: { mainNavigation: string; conversations: string };
  workspace?: { name: string; detail?: string };
  search?: SearchBoxProps["search"];
  account?: UserCardAccount;
  // The conversation list, drawn as the sidebar's `aside.convs`.
  list?: ReactNode;
  chatOpen?: boolean;
  // The More button of the bottom bar; with none the bar has no More tab (R6).
  moreTab?: MoreTab;
  children?: ReactNode;
} & PanelProps;

// The toast places (R23, R25). `AppShell` mounts `ToastProvider` around
// everything it draws, so the `ToastRegion` is the next sibling of `div.app`
// and never inside it: the region has z-index 40 and is not a portal, and
// `div.app` is `position:fixed`, which forms a stacking context. No ancestor of
// the region may form one either.
//
// What the shell registers: `useToastAnchor` on `div.toast-anchor` (the box of
// `main`, the whole shell under 720 px, without the panel from 956 to 1099 px)
// and `useToastAvoid` on the `nav` (the bottom bar under 720 px; in the wide
// layouts its box is a column that does not overlap the anchor). Nothing else.
//
// The rule for a composer (R25, the contract of TOKI-043 and, in the panel, of
// TOKI-045): a composer calls `useToastAvoid(ref)` on its outermost element.
// It is drawn inside `main` or inside the side panel, which are inside this
// provider, so the call has effect. The shell keeps nothing in the way: `.main`
// and `.side` clip with `overflow:hidden` and move no registered element with a
// transform. A composer drawn outside the shell must mount its own provider.
export const AppShell = forwardRef<HTMLDivElement, AppShellProps>(
  function AppShell(props, ref) {
    return (
      <ToastProvider>
        <Shell {...props} forwardedRef={ref} />
      </ToastProvider>
    );
  },
);

function Shell(
  props: AppShellProps & { forwardedRef: ForwardedRef<HTMLDivElement> },
) {
  const {
    forwardedRef: ref,
    sections,
    currentSection,
    onNavigate,
    labels,
    workspace,
    search,
    account,
    list,
    chatOpen = false,
    moreTab,
    panel,
    panelLabel,
    children,
    className,
    ...rest
  } = props;
  const hasList = list !== undefined && list !== null && list !== false;
  const hasPanel = panel !== undefined && panel !== null && panel !== false;
  const pane = derivePane({
    section: currentSection,
    chatOpen,
    panelOpen: hasPanel,
    hasList,
  });
  const anchorRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  useToastAnchor(anchorRef);
  useToastAvoid(navRef);
  const narrow = useNarrow();
  const convsRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const sideRef = useRef<HTMLElement>(null);
  const shownPane = useRef(pane);
  // On a narrow screen the pane that is now shown takes focus, unless the
  // focus is already inside it; not at the first render (R29).
  useEffect(() => {
    if (shownPane.current === pane) return;
    shownPane.current = pane;
    if (!narrow) return;
    const target = { list: convsRef, main: mainRef, side: sideRef }[pane]
      .current;
    if (!target || target.contains(document.activeElement)) return;
    target.focus();
    if (document.activeElement === target) return;
    // The pane is still `visibility:hidden` when the change is committed: its
    // transition has not shown it yet, and a browser refuses the focus of a
    // hidden element. Try again on the next frames, a few times at most.
    let tries = 0;
    let frame = 0;
    const retry = () => {
      if (target.contains(document.activeElement)) return;
      target.focus();
      if (document.activeElement !== target && ++tries < 10) {
        frame = requestAnimationFrame(retry);
      }
    };
    frame = requestAnimationFrame(retry);
    return () => cancelAnimationFrame(frame);
  }, [pane, narrow]);
  return (
    <div
      {...rest}
      ref={ref}
      className={cx("app", className)}
      data-testid="shell"
      data-section={currentSection}
      data-pane={pane}
      data-chat-open={chatOpen ? "" : undefined}
      data-panel={hasPanel ? "" : undefined}
    >
      <div className="sidebar" data-has-list={hasList ? "" : undefined}>
        <nav ref={navRef} className="nav" aria-label={labels.mainNavigation}>
          <WorkspaceHeader workspace={workspace} />
          <SearchBox search={search} />
          <div className="nav-items">
            {sections.map((section) => (
              <NavItem
                key={section.id}
                section={section}
                current={section.id === currentSection}
                onNavigate={onNavigate}
              />
            ))}
          </div>
          <BottomTabs
            sections={sections}
            currentSection={currentSection}
            onNavigate={onNavigate}
            moreTab={moreTab}
          />
        </nav>
        {hasList && (
          <aside
            ref={convsRef}
            className="convs"
            tabIndex={-1}
            aria-label={labels.conversations}
          >
            {list}
          </aside>
        )}
        <UserCard account={account} />
      </div>
      <main ref={mainRef} className="main" tabIndex={-1}>
        {children}
      </main>
      {hasPanel && (
        <aside
          ref={sideRef}
          className="side"
          tabIndex={-1}
          aria-label={panelLabel}
        >
          {panel}
        </aside>
      )}
      <div ref={anchorRef} className="toast-anchor" aria-hidden="true" />
    </div>
  );
}
