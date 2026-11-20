import {
  AddMembersResponseSchema,
  BootstrapResponse,
  BrowseChannelsResponseSchema,
  ChangeChannelResponseSchema,
  ChannelMembersResponseSchema,
  CreateChannelResponseSchema,
  GetChannelResponseSchema,
  LeaveChannelResponseSchema,
  OpenDirectResponseSchema,
  RemoveMemberResponseSchema,
  UpdateSettingsResponseSchema,
  type CreateChannelBodySchema,
  type EditChannelBodySchema,
  type SettingsPatch,
} from "@toki/shared";
import type { z } from "zod";
import type { RequestOptions } from "./client";

// One typed method for each route of the bootstrap, channel, direct-message
// and settings requests (TOKI-032 R9). Each sends exactly what the route
// takes and reads the answer with the shared schema; none re-checks a rule of
// the server before sending. A path part is encoded. Each takes an optional
// `signal` last, and neither `headers` nor `timeoutMs`.
type Send = <S extends z.ZodType>(
  request: RequestOptions<S>,
) => Promise<{ status: number; data: z.output<S> }>;

type Signal = AbortSignal | undefined;
export type CreateChannelInput = z.input<typeof CreateChannelBodySchema>;
export type EditChannelInput = z.input<typeof EditChannelBodySchema>;
export type ListQuery = { search?: string; limit?: number; cursor?: string };
export type PageQuery = { limit?: number; cursor?: string };

const enc = encodeURIComponent;

export function buildMethods(send: Send) {
  const channelPath = (id: string) => `/channels/${enc(id)}`;
  // A POST with no body: leave, archive, restore.
  const post = <S extends z.ZodType>(path: string, schema: S, signal: Signal) =>
    send({ method: "POST", path, schema, signal });

  return {
    bootstrap: async (signal?: AbortSignal) =>
      (
        await send({
          method: "GET",
          path: "/bootstrap",
          schema: BootstrapResponse,
          signal,
        })
      ).data,

    channels: {
      create: async (body: CreateChannelInput, signal?: AbortSignal) => {
        const { status, data } = await send({
          method: "POST",
          path: "/channels",
          body,
          schema: CreateChannelResponseSchema,
          signal,
        });
        return { channel: data.channel, created: status === 201 };
      },
      list: async (query: ListQuery = {}, signal?: AbortSignal) =>
        (
          await send({
            method: "GET",
            path: "/channels",
            query: {
              search: query.search,
              limit: query.limit,
              cursor: query.cursor,
            },
            schema: BrowseChannelsResponseSchema,
            signal,
          })
        ).data,
      get: async (id: string, signal?: AbortSignal) =>
        (
          await send({
            method: "GET",
            path: channelPath(id),
            schema: GetChannelResponseSchema,
            signal,
          })
        ).data,
      members: async (
        id: string,
        query: PageQuery = {},
        signal?: AbortSignal,
      ) =>
        (
          await send({
            method: "GET",
            path: `${channelPath(id)}/members`,
            query: { limit: query.limit, cursor: query.cursor },
            schema: ChannelMembersResponseSchema,
            signal,
          })
        ).data,
      update: async (
        id: string,
        body: EditChannelInput,
        signal?: AbortSignal,
      ) =>
        (
          await send({
            method: "PATCH",
            path: channelPath(id),
            body,
            schema: ChangeChannelResponseSchema,
            signal,
          })
        ).data,
      join: async (
        id: string,
        settings?: SettingsPatch,
        signal?: AbortSignal,
      ) => {
        const hasSettings =
          settings !== undefined && Object.keys(settings).length > 0;
        return (
          await send({
            method: "POST",
            path: `${channelPath(id)}/join`,
            body: hasSettings ? { settings } : undefined,
            schema: ChangeChannelResponseSchema,
            signal,
          })
        ).data;
      },
      addMembers: async (id: string, userIds: string[], signal?: AbortSignal) =>
        (
          await send({
            method: "POST",
            path: `${channelPath(id)}/members`,
            body: { userIds },
            schema: AddMembersResponseSchema,
            signal,
          })
        ).data,
      leave: async (id: string, signal?: AbortSignal) =>
        (
          await post(
            `${channelPath(id)}/leave`,
            LeaveChannelResponseSchema,
            signal,
          )
        ).data,
      removeMember: async (id: string, userId: string, signal?: AbortSignal) =>
        (
          await send({
            method: "DELETE",
            path: `${channelPath(id)}/members/${enc(userId)}`,
            schema: RemoveMemberResponseSchema,
            signal,
          })
        ).data,
      archive: async (id: string, signal?: AbortSignal) =>
        (
          await post(
            `${channelPath(id)}/archive`,
            ChangeChannelResponseSchema,
            signal,
          )
        ).data,
      restore: async (id: string, signal?: AbortSignal) =>
        (
          await post(
            `${channelPath(id)}/restore`,
            ChangeChannelResponseSchema,
            signal,
          )
        ).data,
    },

    directConversations: {
      open: async (userIds: string[], signal?: AbortSignal) => {
        const { status, data } = await send({
          method: "POST",
          path: "/direct-conversations",
          body: { userIds },
          schema: OpenDirectResponseSchema,
          signal,
        });
        return { conversation: data.conversation, created: status === 201 };
      },
    },

    conversations: {
      saveSettings: async (
        id: string,
        patch: SettingsPatch,
        signal?: AbortSignal,
      ) =>
        (
          await send({
            method: "PATCH",
            path: `/conversations/${enc(id)}/settings`,
            body: patch,
            schema: UpdateSettingsResponseSchema,
            signal,
          })
        ).data,
    },
  };
}
