import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BootstrapResponse, effectiveNotificationLevel } from "@toki/shared";
import { createHarness, type Harness } from "../auth/test-harness.js";
import { insertConversation, insertConversationMember } from "../test-rows.js";
import { buildBootstrap } from "../../src/bootstrap/build.js";
import { AppError } from "../../src/errors.js";
import { getAccountsByIds } from "../../src/modules/members/index.js";
import type { Tx } from "../../src/db/client.js";

let h: Harness;
let admin: string;
let sam: string;
beforeAll(async () => {
  h = await createHarness();
  admin = await h.addUser("admin@example.com", {
    role: "admin",
    display_name: "Ada",
  });
  sam = await h.addUser("sam@example.com", { display_name: "Sam" });
});
afterAll(async () => {
  await h?.close();
});

const channel = (name: string, members: string[] = [], values = {}) =>
  insertConversation(h.sql, {
    workspace_id: h.workspaceId,
    created_by: admin,
    name,
    ...values,
  }).then(async (id) => {
    for (const user_id of members) {
      await insertConversationMember(h.sql, {
        conversation_id: id,
        user_id,
        workspace_id: h.workspaceId,
      });
    }
    return id;
  });

describe("buildBootstrap: the parts (R3, R4, R8, R19)", () => {
  it("returns a valid answer with the user, the workspace, the people and the event number 0", async () => {
    const general = await channel("general", [admin, sam], {
      is_general: true,
    });
    const answer = await buildBootstrap(h.db, { id: admin });
    expect(BootstrapResponse.safeParse(answer).success).toBe(true);
    expect(answer.user).toEqual({
      id: admin,
      email: "admin@example.com",
      displayName: "Ada",
      role: "admin",
      language: "en",
    });
    expect(answer.workspace).toEqual({ id: h.workspaceId, name: "Acme" });
    expect(answer.members.map((m) => m.id).sort()).toEqual([admin, sam].sort());
    expect(answer.conversations.map((c) => c.id)).toContain(general);
    expect(answer.eventNumber).toBe(0);
  });

  it("returns the level that applies: the stored one, or the default of the kind", async () => {
    const mine = await h.addUser("level@example.com");
    const a = await channel("lvl-a", [mine]);
    const b = await channel("lvl-b", [mine]);
    await h.sql`update conversation_members set notification_level = 'none', is_muted = true, is_starred = true where conversation_id = ${b} and user_id = ${mine}`;
    const answer = await buildBootstrap(h.db, { id: mine });
    const byId = new Map(answer.conversations.map((c) => [c.id, c]));
    expect(byId.get(a)).toMatchObject({
      notificationLevel: effectiveNotificationLevel("channel", null),
      isMuted: false,
      isStarred: false,
    });
    expect(byId.get(a)!.notificationLevel).toBe("mentions");
    expect(byId.get(b)).toMatchObject({
      notificationLevel: "none",
      isMuted: true,
      isStarred: true,
    });
  });

  it("answers 401 account_deactivated or unauthenticated when the snapshot shows no usable account", async () => {
    const gone = await h.addUser("gone@example.com", { status: "deactivated" });
    await expect(buildBootstrap(h.db, { id: gone })).rejects.toMatchObject({
      status: 401,
      code: "account_deactivated",
    });
    await expect(
      buildBootstrap(h.db, { id: crypto.randomUUID() }),
    ).rejects.toMatchObject({ status: 401, code: "unauthenticated" });
  });
});

describe("buildBootstrap: the workspace check (R4)", () => {
  it("fails with a plain error, not a business answer, when the workspace ids differ", async () => {
    const error = await buildBootstrap(
      h.db,
      { id: admin },
      {
        getAccountsByIds: async (client, ids, options) =>
          (await getAccountsByIds(client, ids, options)).map((r) => ({
            ...r,
            workspaceId: crypto.randomUUID(),
          })),
      },
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(AppError);
  });

  it("fails with a plain error when there is no workspace row", async () => {
    await expect(
      buildBootstrap(h.db, { id: admin }, { getWorkspace: async () => null }),
    ).rejects.not.toBeInstanceOf(AppError);
  });
});

describe("buildBootstrap: one snapshot (R10)", () => {
  it("shows none of four changes committed by another connection after the account was read, and the next call shows all", async () => {
    const boss = await h.addUser("snap-admin@example.com", { role: "admin" });
    const open = await channel("snap-open"); // the person is not in it yet
    let seen: { iso: string; ro: string } | undefined;
    const before = await buildBootstrap(h.db, { id: boss });
    expect(before.user.role).toBe("admin");

    const during = await buildBootstrap(
      h.db,
      { id: boss },
      {
        afterAccount: async (tx: Tx) => {
          const [iso] = await tx.execute<{ transaction_isolation: string }>(
            "show transaction_isolation" as never,
          );
          const [ro] = await tx.execute<{ transaction_read_only: string }>(
            "show transaction_read_only" as never,
          );
          seen = {
            iso: iso!.transaction_isolation,
            ro: ro!.transaction_read_only,
          };
          // Four changes committed through another connection.
          await h.sql`update users set role = 'member' where id = ${boss}`;
          await h.addUser("snap-new@example.com", {
            display_name: "Newcomer",
          });
          await channel("snap-new-channel", [boss]);
          await insertConversationMember(h.sql, {
            conversation_id: open,
            user_id: boss,
            workspace_id: h.workspaceId,
          });
        },
      },
    );
    expect(seen).toEqual({ iso: "repeatable read", ro: "on" });
    expect(during.user.role).toBe("admin");
    const self = during.members.find((m) => m.id === boss)!;
    expect(self.role).toBe(during.user.role);
    expect(during.members.map((m) => m.displayName)).not.toContain("Newcomer");
    const names = during.conversations.map((c) =>
      c.kind === "channel" ? c.name : null,
    );
    expect(names).not.toContain("snap-new-channel");
    expect(during.conversations.map((c) => c.id)).not.toContain(open);

    const after = await buildBootstrap(h.db, { id: boss });
    expect(after.user.role).toBe("member");
    expect(after.members.find((m) => m.id === boss)!.role).toBe("member");
    expect(after.members.map((m) => m.displayName)).toContain("Newcomer");
    expect(
      after.conversations.map((c) => (c.kind === "channel" ? c.name : null)),
    ).toContain("snap-new-channel");
    expect(after.conversations.map((c) => c.id)).toContain(open);
  });

  it("refuses a write on the transaction with 25006", async () => {
    let failure: unknown;
    await buildBootstrap(
      h.db,
      { id: admin },
      {
        afterAccount: async (tx: Tx) => {
          failure = await tx
            .execute(
              `update users set language = 'vi' where id = '${admin}'` as never,
            )
            .catch((e: unknown) => e);
        },
      },
    ).catch(() => undefined);
    expect(failure).toMatchObject({ cause: { code: "25006" } });
  });
});

describe("buildBootstrap: the event number (R11)", () => {
  it("returns what the function returns, called with the transaction the other reads used", async () => {
    let seam: Tx | undefined;
    let given: Tx | undefined;
    const answer = await buildBootstrap(
      h.db,
      { id: admin },
      {
        afterAccount: async (tx) => {
          seam = tx;
        },
        readEventNumber: async (tx) => {
          given = tx;
          return 41;
        },
      },
    );
    expect(answer.eventNumber).toBe(41);
    expect(given).toBeDefined();
    expect(given).toBe(seam);
  });
});
