import { asValue, Lifetime } from "awilix";

import { container } from "../../cli.mjs";
import { FaunaAccountClient } from "../fauna-account-client.mjs";
import { cleanupSecretsFile } from "../file-util.mjs";
import { AccountKeys } from "./accountKeys.mjs";
import { DatabaseKeys } from "./databaseKeys.mjs";

const validateCredentialArgs = (argv) => {
  if (argv.database && argv.secret) {
    throw new Error(
      "Cannot provide both a database and a secret. Please provide one or the other.",
    );
  }
};

export class Credentials {
  constructor(argv) {
    // Get rid of orphaned database keys in the local storage
    cleanupSecretsFile();
    // Make sure auth-related arguments from users are legal
    validateCredentialArgs(argv);

    this.accountKeys = new AccountKeys(argv);
    this.databaseKeys = new DatabaseKeys(argv, this.accountKeys.key);
  }

  async login(accessToken) {
    const { accountKey, refreshToken } =
      await FaunaAccountClient.getSession(accessToken);
    this.accountKeys.keyStore.save({
      accountKey,
      refreshToken,
      // TODO: set expiration
    });
    this.accountKeys.key = accountKey;
  }
}

/**
 * Build the singleton credentials class with the built out yargs arguments.
 * Within credentials class are the account and database key classes
 * @param {*} argv
 */
export function buildCredentials(argv) {
  const credentials = new Credentials(argv);
  container.register({
    credentials: asValue(credentials, { lifetime: Lifetime.SINGLETON }),
  });
}
