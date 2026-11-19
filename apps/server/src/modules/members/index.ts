// The public surface of this module. No table is exported from here.
export {
  countAccounts,
  createFirstAdminAccount,
  findAccountByEmail,
  getAccountById,
  getAccountsByIds,
} from "./accounts.js";
export type { Account, AccountFacts } from "./accounts.js";
