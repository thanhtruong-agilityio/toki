import { z } from "zod";

// The reading of a good answer (TOKI-032 R3). The schemas of @toki/shared are
// strict, which is right for the server's tests and wrong for a client that
// must keep working when the API adds a field within a version. `lenient`
// derives, from any shared schema, a reading that drops the keys it does not
// know at every level and still fails on a missing or wrong known key. The
// exported schemas are not touched.

type AnySchema = z.ZodType;

// Types that have nothing inside to walk. Their own checks (a pattern, an
// integer, a range) stay, because they are reused as they are.
const LEAVES = new Set([
  "string",
  "number",
  "boolean",
  "null",
  "undefined",
  "unknown",
  "any",
  "never",
  "void",
  "literal",
  "enum",
  "date",
  "bigint",
  "nan",
  "symbol",
]);

type Def = { type: string } & Record<string, unknown>;
const defOf = (schema: AnySchema): Def =>
  (schema as unknown as { _zod: { def: Def } })._zod.def;
const cloneWith = (schema: AnySchema, def: Record<string, unknown>) =>
  (schema as unknown as { clone(def: unknown): AnySchema }).clone(def);

// How many keys of an object an answer must have, to order a union: the branch
// that needs the most keys is tried first, so a detail is never read as the
// summary that is a subset of it and silently loses fields.
function requiredKeys(schema: AnySchema): number {
  const def = defOf(schema);
  if (def.type !== "object") return 0;
  const shape = def.shape as Record<string, AnySchema>;
  return Object.values(shape).filter(
    (field) =>
      (field as unknown as { _zod: { optin?: string } })._zod.optin !==
      "optional",
  ).length;
}

const cache = new WeakMap<AnySchema, AnySchema>();

function walk(schema: AnySchema): AnySchema {
  const cached = cache.get(schema);
  if (cached) return cached;
  const def = defOf(schema);
  let result: AnySchema;
  if (LEAVES.has(def.type)) {
    result = schema;
  } else if (def.type === "object") {
    const shape: Record<string, AnySchema> = {};
    for (const [key, field] of Object.entries(
      def.shape as Record<string, AnySchema>,
    )) {
      shape[key] = walk(field);
    }
    // No catchall: an unknown key is stripped, not refused. The checks of the
    // object itself (def.checks) are kept by cloning the definition.
    result = cloneWith(schema, { ...def, shape, catchall: undefined });
  } else if (def.type === "array") {
    result = cloneWith(schema, {
      ...def,
      element: walk(def.element as AnySchema),
    });
  } else if (
    def.type === "optional" ||
    def.type === "nullable" ||
    def.type === "nonoptional" ||
    def.type === "default"
  ) {
    result = cloneWith(schema, {
      ...def,
      innerType: walk(def.innerType as AnySchema),
    });
  } else if (def.type === "union") {
    const options = (def.options as AnySchema[]).map(walk);
    const ordered = options
      .map((option, index) => ({ option, index }))
      .sort(
        (a, b) =>
          requiredKeys(b.option) - requiredKeys(a.option) || a.index - b.index,
      )
      .map(({ option }) => option);
    result = cloneWith(schema, { ...def, options: ordered });
  } else {
    // A schema type this walk does not know is a decision for a person: it
    // fails loudly, and the tests list the types the shared schemas use.
    throw new Error(
      `The client cannot read an answer with a "${def.type}" schema.`,
    );
  }
  cache.set(schema, result);
  return result;
}

export function lenient<T extends AnySchema>(schema: T): AnySchema {
  return walk(schema);
}

export type ReadResult =
  | { ok: true; data: unknown }
  | { ok: false; reason: "unsupported" | "mismatch" };

// Reads a decoded body with the lenient form of `schema`.
export function readAnswer(schema: AnySchema, value: unknown): ReadResult {
  let reader: AnySchema;
  try {
    reader = lenient(schema);
  } catch {
    return { ok: false, reason: "unsupported" };
  }
  const parsed = reader.safeParse(value);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, reason: "mismatch" };
}

// A schema that accepts any answer as it is. For a caller that reads the answer
// itself (the sign-in calls of the web app); no unknown key is dropped.
export const anyAnswer = z.unknown();
