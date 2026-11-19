import {
  forwardRef,
  type ComponentPropsWithRef,
  type ComponentPropsWithoutRef,
} from "react";
import { Avatar } from "../components/Avatar";
import type { PresenceState } from "../components/PresenceDot";
import { cx } from "../internal/cx";
import "./shell.css";

// What `useMenuTrigger<HTMLButtonElement>().triggerProps` returns (TOKI-014
// R24): the props of a button without the four the card owns.
export type AccountTriggerProps = Omit<
  ComponentPropsWithRef<"button">,
  "children" | "className" | "type" | "aria-label"
>;

export type UserCardAccount = {
  label: string;
  name: string;
  hue: number;
  presence?: PresenceState;
  presenceLabel?: string;
  detail?: string;
  triggerProps?: AccountTriggerProps;
};

export type UserCardProps = ComponentPropsWithoutRef<"div"> & {
  account?: UserCardAccount;
};

export const UserCard = forwardRef<HTMLDivElement, UserCardProps>(
  function UserCard({ account, className, ...rest }, ref) {
    if (!account) return null;
    const content = (
      <>
        <Avatar
          name={account.name}
          hue={account.hue}
          presence={account.presence}
          presenceLabel={account.presenceLabel}
          size={36}
        />
        <div className="uct">
          <span className="un">{account.name}</span>
          {account.detail !== undefined && (
            <span className="us">{account.detail}</span>
          )}
        </div>
      </>
    );
    return (
      <div {...rest} ref={ref} className={cx("usercard", className)}>
        {account.triggerProps ? (
          <button
            {...account.triggerProps}
            type="button"
            className="ucard"
            aria-label={account.label}
          >
            {content}
          </button>
        ) : (
          <div className="ucard">{content}</div>
        )}
      </div>
    );
  },
);
