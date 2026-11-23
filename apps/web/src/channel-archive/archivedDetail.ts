import type { ChannelRead } from "./deps";

// True only for a held detail or summary of an archived channel that the person belongs to (R13).
export function isArchivedMember(read: ChannelRead | undefined): boolean {
  return read !== undefined && read.archived === true && read.isMember === true;
}
