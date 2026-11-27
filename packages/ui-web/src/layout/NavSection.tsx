import type { MouseEvent } from "react";
import { Badge } from "../components/Badge";
import { Icon, type IconName } from "../icons";

// One section of the navigation (R5). Every text is already translated.
export type NavSection = {
  id: string;
  icon: IconName;
  label: string;
  href: string;
  badge?: number;
  badgeLabel?: string;
  // Shown in the bottom bar.
  tab?: boolean;
  // Reached from the More sheet on a narrow screen.
  more?: boolean;
};

export type NavigateHandler = (
  section: NavSection,
  event: MouseEvent<HTMLAnchorElement>,
) => void;

// A badge is drawn only for a number above 0; 0, a negative number, NaN and a
// missing value draw nothing (R7).
export function hasBadge(badge: number | undefined): badge is number {
  return typeof badge === "number" && badge > 0;
}

// A plain left click goes to `onNavigate`; the modified clicks, the middle
// click and a missing handler are left to the browser (R5).
export function isPlainClick(event: MouseEvent): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function NavItem({
  section,
  current,
  onNavigate,
}: {
  section: NavSection;
  current: boolean;
  onNavigate?: NavigateHandler;
}) {
  return (
    <a
      className="ni"
      href={section.href}
      data-id={section.id}
      aria-current={current ? "page" : undefined}
      onClick={(event) => {
        if (!onNavigate || !isPlainClick(event)) return;
        event.preventDefault();
        onNavigate(section, event);
      }}
    >
      <Icon name={section.icon} />
      <span className="lb">{section.label}</span>
      {hasBadge(section.badge) && (
        <Badge
          variant={section.id === "home" ? "mute" : undefined}
          label={section.badgeLabel}
        >
          {section.badge}
        </Badge>
      )}
    </a>
  );
}
