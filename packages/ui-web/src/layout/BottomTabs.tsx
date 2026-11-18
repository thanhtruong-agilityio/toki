import type { Ref } from "react";
import { Badge } from "../components/Badge";
import { Icon, MenuIcon } from "../icons";
import {
  hasBadge,
  isPlainClick,
  type NavigateHandler,
  type NavSection,
} from "./NavSection";

// The More button of the bar. The sheet is the owner's (R6, R9): the shell calls
// `onOpen` and nothing else. Every text is already translated.
export type MoreTab = {
  label: string;
  open: boolean;
  onOpen: () => void;
  ref?: Ref<HTMLButtonElement>;
};

export type BottomTabsProps = {
  sections: NavSection[];
  currentSection?: string;
  onNavigate?: NavigateHandler;
  moreTab?: MoreTab;
};

// The narrow bar, drawn inside the shell's `nav` (R6).
export function BottomTabs({
  sections,
  currentSection,
  onNavigate,
  moreTab,
}: BottomTabsProps) {
  const moreCurrent = sections.some(
    (section) => section.more && section.id === currentSection,
  );
  return (
    <div className="nav-tabs">
      {sections
        .filter((section) => section.tab)
        .map((section) => (
          <a
            key={section.id}
            className="nt"
            href={section.href}
            data-id={section.id}
            aria-current={section.id === currentSection ? "page" : undefined}
            onClick={(event) => {
              if (!onNavigate || !isPlainClick(event)) return;
              event.preventDefault();
              onNavigate(section, event);
            }}
          >
            <Icon name={section.icon} />
            <span>{section.label}</span>
            {hasBadge(section.badge) && (
              <Badge
                variant={section.id === "home" ? "mute" : undefined}
                label={section.badgeLabel}
              >
                {section.badge}
              </Badge>
            )}
          </a>
        ))}
      {moreTab && (
        <button
          type="button"
          ref={moreTab.ref}
          className="nt"
          aria-haspopup="dialog"
          aria-expanded={moreTab.open}
          aria-current={moreCurrent ? "page" : undefined}
          onClick={() => moreTab.onOpen()}
        >
          <MenuIcon />
          <span>{moreTab.label}</span>
        </button>
      )}
    </div>
  );
}
