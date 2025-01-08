import { asValue, Lifetime } from "awilix";

import { container } from "../../cli.mjs";
import { AuthenticationError, ValidationError } from "../errors.mjs";
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
    const { getSession } = container.resolve("accountAPI");
    const { accountKey, refreshToken } = await getSession(accessToken);

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

const isAuthorizationError = (err) => {
  return (
    err &&
    (err instanceof AuthenticationError ||
      err.name === "unauthorized" ||
      err.httpStatus === 401 ||
      err.status === 401 ||
      err.requestResult?.statusCode === 401)
  );
};

/**
 * Creates a function that will retry an operation once if it encounters an authorization error.
 * @param {Object} params - The arguments to pass to the function
 * @param {DatabaseKeys | AccountKeys} params.keyProvider - The key provider to use for refreshing the secret
 * @param {(secret: string) => Promise<any>} params.fn - The function to retry using the injected secret as the first argument. Should
 *  throw an error if it encounters a retryable failure.
 * @param {{err: unknown} => boolean} [params.shouldRetry] - The function to determine if the error is a retryable 401
 * @returns {Promise<any>} - The result of the function fn
 */
export const retryAuthorizationErrorOnce = async ({
  keyProvider,
  fn,
  shouldRetry = isAuthorizationError,
}) => {
  const logger = container.resolve("logger");

  try {
    return await fn(keyProvider.key);
  } catch (err) {
    // If it's a 401, we need to refresh the secret. Let's just do type narrowing here
    // vs doing another v4 vs v10 check.
    if (shouldRetry(err)) {
      logger.debug(
        "Retryable 401 error, attempting to refresh session",
        "creds",
      );

      await keyProvider.onInvalidCreds(err);

      try {
        return await fn(keyProvider.key);
      } catch (err) {
        if (shouldRetry(err)) {
          logger.debug(
            "Failed to refresh session, expired or missing refresh token",
            "creds",
          );
          const credentials = container.resolve("credentials");
          credentials.accountKeys.promptLogin();
        }
        throw err;
      }
    }
    throw err;
  }
};
