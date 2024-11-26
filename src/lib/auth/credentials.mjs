import { asValue, Lifetime } from "awilix";

import { container } from "../../cli.mjs";
import { FaunaAccountClient } from "../fauna-account-client.mjs";
import { cleanupSecretsFile } from "../file-util.mjs";
import { AccountCreds } from "./accountCreds.mjs";
import { DatabaseCreds } from "./databaseCreds.mjs";

const validateCredentialArgs = (argv) => {
  if (argv.database && argv.secret) {
    throw new Error(
      "Cannot provide both a database and a secret. Please provide one or the other.",
    );
  }
};

/**
 * Build singletons for the command helpers to use.
 * These keep track of the correct account and database keys to use
 * @param {*} argv
 */
export function buildCredentials(argv) {
  // Get rid of orphaned database keys in the local storage
  cleanupSecretsFile();
  // Make sure auth-related arguments from users are legal
  validateCredentialArgs(argv);
  const accountCreds = new AccountCreds(argv);
  const databaseCreds = new DatabaseCreds(argv, accountCreds.accountKey);
  const accountClient = new FaunaAccountClient(accountCreds);
  container.register({
    accountClient: asValue(accountClient, { lifetime: Lifetime.SINGLETON }),
    accountCreds: asValue(accountCreds, { lifetime: Lifetime.SINGLETON }),
    databaseCreds: asValue(databaseCreds, { lifetime: Lifetime.SINGLETON }),
  });
}
