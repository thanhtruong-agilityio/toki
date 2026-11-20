import { useTranslation } from "@toki/i18n/react";
import { canInviteMember } from "@toki/shared";
import { Button, SectionPage } from "@toki/ui-web";
import { useRef, useState } from "react";
import { useSession } from "../useSession";
import { ChannelsSection } from "./ChannelsSection";
import { InviteDialog } from "./InviteDialog";
import { MembersSection } from "./MembersSection";
import { AdminNotices } from "./notices";
import { useKeyPerId } from "./useKeyPerId";
import { useMemberList } from "./useMemberList";

// The Admin page inside the shell's section frame (TOKI-025 R1): the notices, the members section,
// the Channels section and the Invite members dialog. It owns the member list and the page's
// idempotency keys, which the table's Resend buttons and the dialog share (R20).
export function AdminPage() {
  const { t } = useTranslation();
  const session = useSession();
  const list = useMemberList();
  const keys = useKeyPerId();
  const [inviteOpen, setInviteOpen] = useState(false);
  const inviteButton = useRef<HTMLButtonElement>(null);

  // AdminRoute lets only an Admin in, so a person is always there; the actor is read again here
  // for the permission functions.
  const actor =
    session.status === "signedIn"
      ? { id: session.user.id, role: session.user.role }
      : null;
  const canInvite =
    actor !== null && canInviteMember(actor, { role: "member" }).allowed;

  return (
    <SectionPage
      title={t("nav.admin")}
      actions={
        canInvite ? (
          <Button
            ref={inviteButton}
            variant="primary"
            onClick={() => setInviteOpen(true)}
          >
            {t("admin.invite.open")}
          </Button>
        ) : null
      }
    >
      <div className="adm-notices">
        <AdminNotices />
      </div>
      {actor ? <MembersSection list={list} actor={actor} keys={keys} /> : null}
      <ChannelsSection />
      {canInvite ? (
        <InviteDialog
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          reload={list.reload}
          keys={keys}
          returnFocusRef={inviteButton}
        />
      ) : null}
    </SectionPage>
  );
}
