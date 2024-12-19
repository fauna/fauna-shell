import { asValue, Lifetime } from "awilix";

import { container } from "../../cli.mjs";
import { ValidationError } from "../errors.mjs";
import { FaunaAccountClient } from "../fauna-account-client.mjs";
import { isLocal } from "../middleware.mjs";
import { AccountKeys } from "./accountKeys.mjs";
import { DatabaseKeys } from "./databaseKeys.mjs";

const validateCredentialArgs = (argv) => {
  const logger = container.resolve("logger");
  const illegalArgCombos = [
    ["accountKey", "secret", isLocal],
    ["secret", "database", isLocal],
    ["secret", "role", isLocal],
  ];
  for (const [first, second, conditional] of illegalArgCombos) {
    if (argv[first] && argv[second] && !conditional(argv)) {
      throw new ValidationError(
        `Cannot use both the '--${first}' and '--${second}' options together. Please specify only one.`,
      );
    }
  }

  if (argv.user && argv.accountKey) {
    logger.debug(
      "Both 'user' and 'accountKey' arguments were specified. 'accountKey' will be used to mint database secrets. 'user' will be ignored.",
      "creds",
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
