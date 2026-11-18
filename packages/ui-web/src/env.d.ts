// The one field of Vite's `import.meta.env` that this package reads
// (ConfirmDialog R5). The consuming app and Vitest provide the value.
interface ImportMeta {
  readonly env: { readonly DEV: boolean };
}
