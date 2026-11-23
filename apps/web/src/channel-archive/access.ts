import { canArchiveChannel, canRestoreChannel } from "@toki/shared";

// Who is offered what (R6, R7). Both are pure: the rule is the one of `@toki/shared` (TOKI-027 R9),
// and no role is compared here (TOKI-027 R16). A fact that is not known denies.
type Actor = { id: string; role: string } | null | undefined;

export type ChannelFacts = {
  isPrivate: boolean;
  isGeneral: boolean;
  // `undefined` when the detail is not held yet.
  archived: boolean | undefined;
  isMember: boolean;
};

type Input = { actor: Actor; channel: ChannelFacts };

function facts(channel: ChannelFacts & { archived: boolean }) {
  return {
    kind: channel.isPrivate
      ? ("private_channel" as const)
      : ("public_channel" as const),
    isGeneral: channel.isGeneral,
    archived: channel.archived,
    isMember: channel.isMember,
  };
}

export function canOfferArchive({ actor, channel }: Input): boolean {
  if (!actor || channel.archived !== false) return false;
  return canArchiveChannel(actor, facts({ ...channel, archived: false }))
    .allowed;
}

// Any Admin restores, a member of the channel or not (concern 1): `isMember` is not read.
export function canOfferRestore({ actor, channel }: Input): boolean {
  if (!actor || channel.archived !== true) return false;
  return canRestoreChannel(actor, facts({ ...channel, archived: true }))
    .allowed;
}
