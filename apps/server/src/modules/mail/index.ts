// The public entry of the mail module (R1): the only file other code imports.
export { mailConfigSchema, mailVariableNames } from "./config.js";
export type { MailConfig } from "./config.js";
export { createMailLayer } from "./layer.js";
export type {
  CallOptions,
  CreateMailLayerOptions,
  Limits,
  MailLayer,
  MailLogger,
  MailResult,
} from "./layer.js";
