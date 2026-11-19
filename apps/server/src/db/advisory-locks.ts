// Every advisory lock of the server, in one place. The first integer is the
// namespace (the four bytes of the ASCII text "TOKI"), the second is the key
// of one step; a later ticket that takes an advisory lock adds its own key
// here under the same namespace, so two steps never share a lock.
export const ADVISORY_NAMESPACE = 1414482761;

export const ADVISORY_KEYS = {
  // The first set-up of the installation (TOKI-020 R9).
  firstAdmin: 1,
} as const;
