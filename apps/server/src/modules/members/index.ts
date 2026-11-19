// The public surface of this module. No table is exported from here.
export {
  countAccounts,
  createFirstAdminAccount,
  findAccountByEmail,
  getAccountById,
} from "./accounts.js";
export type { Account } from "./accounts.js";
