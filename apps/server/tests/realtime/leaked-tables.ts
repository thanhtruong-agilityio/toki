// Test-only: the names of the exports that are a definition of schema.ts, as in
// the export test of the conversations module.
export function leakedTables(
  exported: Record<string, unknown>,
  tables: Record<string, unknown>,
): string[] {
  const tableObjects = new Set<unknown>(Object.values(tables));
  return Object.entries(exported)
    .filter(([, value]) => tableObjects.has(value))
    .map(([name]) => name);
}
