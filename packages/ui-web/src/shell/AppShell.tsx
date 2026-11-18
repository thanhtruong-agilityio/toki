import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { cx } from "../internal/cx";
import { derivePane } from "./derivePane";
import { NavItem, type NavigateHandler, type NavSection } from "./NavSection";
import { SearchBox, type SearchBoxProps } from "./SearchBox";
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
  children?: ReactNode;
} & PanelProps;

export const AppShell = forwardRef<HTMLDivElement, AppShellProps>(
  function AppShell(props, ref) {
    const {
      sections,
      currentSection,
      onNavigate,
      labels,
      workspace,
      search,
      account,
      list,
      chatOpen = false,
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
          <nav className="nav" aria-label={labels.mainNavigation}>
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
          </nav>
          {hasList && (
            <aside className="convs" aria-label={labels.conversations}>
              {list}
            </aside>
          )}
          <UserCard account={account} />
        </div>
        <main className="main">{children}</main>
        {hasPanel && (
          <aside className="side" aria-label={panelLabel}>
            {panel}
          </aside>
        )}
        <div className="toast-anchor" aria-hidden="true" />
      </div>
    );
  },
);
