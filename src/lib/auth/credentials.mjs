import { asValue, Lifetime } from "awilix";

import { container } from "../../cli.mjs";
import { ValidationError } from "../command-helpers.mjs";
import { FaunaAccountClient } from "../fauna-account-client.mjs";
import { AccountKeys } from "./accountKeys.mjs";
import { DatabaseKeys } from "./databaseKeys.mjs";

const validateCredentialArgs = (argv) => {
  if (argv.database && argv.secret) {
    throw new ValidationError(
      "Cannot use both the '--secret' and '--database' options together. Please specify only one.",
    );
  } else if (argv.role && argv.secret) {
    // The '--role' option is not supported when using a secret. Secrets have an
    // implicit role.
    throw new ValidationError(
      "The '--role' option is not supported when using a '--secret'. Please specify only one.",
    );
  }
};

export class Credentials {
  constructor(argv) {
    // Get rid of orphaned database keys in the local storage
    // Make sure auth-related arguments from users are legal
    validateCredentialArgs(argv);
    this.accountKeys = new AccountKeys(argv);
    this.databaseKeys = new DatabaseKeys(argv, this.accountKeys.key);
    this.cleanupSecretsFile();
  }

  /**
   * Steps through account keys in local filesystem and if they are not found in the secrets file,
   *   delete the stale entries on the secrets file.
   */
  cleanupSecretsFile() {
    const accountKeyData = this.accountKeys.keyStore.getFile();
    const accountKeys = Object.values(accountKeyData).map(
      (value) => value.accountKey,
    );
    const secretKeyData = this.databaseKeys.keyStore.getFile();
    Object.keys(secretKeyData).forEach((accountKey) => {
      if (!accountKeys.includes(accountKey)) {
        this.databaseKeys.keyStore.updateAccountKey(accountKey);
        this.databaseKeys.keyStore.deleteAllDBKeysForAccount();
      }
    });
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
