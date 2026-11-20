import { effectiveNotificationLevel } from "@toki/shared";
import type {
  BootstrapConversation,
  BootstrapChannelEntry,
} from "@toki/shared";
import type { ChannelRead, SettingsValues } from "./types";

// The entry merge rule (TOKI-032 R13). A channel answer carries no level, mute
// or star, so an entry made from it keeps those the store already holds for
// the id; for an id it does not hold they are the values of a new member row
// (D-046): the level that applies to a channel, not muted, not starred. The
// description, creator, date, `archived` and `memberCount` are not part of an
// entry.
export function entryFromChannel(
  channel: ChannelRead,
  held: BootstrapConversation | undefined,
  values?: Partial<SettingsValues>,
): BootstrapChannelEntry {
  const own: SettingsValues =
    held !== undefined
      ? {
          notificationLevel: held.notificationLevel,
          isMuted: held.isMuted,
          isStarred: held.isStarred,
        }
      : {
          notificationLevel: effectiveNotificationLevel("channel", null),
          isMuted: false,
          isStarred: false,
        };
  return {
    id: channel.id,
    kind: "channel",
    name: channel.name,
    topic: channel.topic,
    isPrivate: channel.isPrivate,
    isGeneral: channel.isGeneral,
    notificationLevel: values?.notificationLevel ?? own.notificationLevel,
    isMuted: values?.isMuted ?? own.isMuted,
    isStarred: values?.isStarred ?? own.isStarred,
    memberIds: null,
  };
}

// Whether the person is a member of an active channel, by this answer.
export const isActiveMember = (channel: ChannelRead): boolean =>
  channel.isMember && !channel.archived;

// A held detail the bootstrap answer contradicts (R14): the answer lists the id
// and the detail says the person is not a member or the channel is archived,
// or the answer does not list it and the detail says the person is a member of
// an active channel. The details of archived channels and of channels the
// person has not joined stay.
export function contradicted(
  detail: ChannelRead,
  listedInAnswer: boolean,
): boolean {
  if (listedInAnswer) return !isActiveMember(detail);
  return isActiveMember(detail);
}
