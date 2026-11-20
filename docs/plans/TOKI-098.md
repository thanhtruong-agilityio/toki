# TOKI-098 Create channel dialog - first pull request: the id generator

**Spec:** `docs/specs/2026-11-17-create-channel-dialog-design.md` (R1, R2; concern 12: this ticket builds the ids part; TOKI-025 reuses it). Tier S.

**Scope of this pull request:** the id generator only. The dialog (R3 to R22) waits for TOKI-033 (`personHue`, `useConversationSelector`) and TOKI-034 (`PeoplePicker`), which are not on `main`; it comes in a later pull request on the same ticket.

| Requirement | Step | Test |
|---|---|---|
| R1 generator | `packages/shared/src/ids/uuid-v7.ts`, re-exported from `packages/shared/src/index.ts` | `packages/shared/tests/ids/uuid-v7.test.ts`: the four exact outputs, fraction floored, 1000 ids match the pattern and differ, -1 / 2^48 / NaN / Infinity throw without asking for bytes, 9 bytes throws |
| R2 web id | `apps/web/src/ids.ts` exports `newId` (clock of `apps/web/src/clock.ts`, `crypto.getRandomValues`) | `apps/web/tests/ids.test.ts`: `newId()` matches the pattern; works without `crypto.randomUUID`; scan finds `crypto.`, `randomUUID`, `getRandomValues` only in `ids.ts` (allowed files in one array at the top) |

**Riskiest step:** a lint rule may refuse `crypto` in `apps/web/src`; check `pnpm lint` and `pnpm lint:boundaries` and add the one allowance for `ids.ts` if the rule needs it.
**Order:** write each test, see it fail, then the code; end with the commands of R22 that exist.
