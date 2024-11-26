import { asValue, Lifetime } from "awilix";

import { container } from "../../cli.mjs";
import { FaunaAccountClient } from "../fauna-account-client.mjs";
import {
  AccountKeyStorage,
  cleanupSecretsFile,
  SecretKeyStorage,
} from "../file-util.mjs";
import { InvalidCredsError } from "../misc.mjs";

const TTL_DEFAULT_MS = 1000 * 60 * 15; // 15 minutes
// Look at the various sources of credentials and resolve accordingly.
//   This is the only time env vars will be considered. We can refresh the env
//   vars during a command (shell) if we want that later.

const resolveCredentials = (argv, storedAccountKey, storedDBKey) => {
  if (argv.database && argv.secret) {
    throw new Error(
      "Cannot provide both a database and a secret. Please provide one or the other.",
    );
  }
  let dbKey,
    dbKeySource,
    accountKey,
    accountKeySource = null;

  // can come from flag, config, or FAUNA_SECRET
  if (argv.secret) {
    dbKey = argv.secret;
    dbKeySource = "user";
  } else {
    dbKey = storedDBKey;
    dbKeySource = "credentials-file";
  }

  // can come from flag, config, or FAUNA_ACCOUNT_KEY
  if (argv.accountKey) {
    accountKey = argv.accountKey;
    accountKeySource = "user";
  } else if (storedAccountKey) {
    accountKey = storedAccountKey;
    accountKeySource = "credentials-file";
  } else if (dbKey) {
    // NOTE: We can technically use a DB key to call frontdoor, so someone might want to pass a secret
    //  and only a secret and have that work for everything. If they pass a secret, we don't want to prompt login
    //  if they don't have an account key.
    accountKey = dbKey;
    accountKeySource = "database-key";
  }
  return {
    dbKey,
    dbKeySource,
    accountKey,
    accountKeySource,
  };
};

/**
 * For any given profile, path and role, this class represents the credentials needed to perform
 * any command in the CLI
 * @member {string} database - The database name.
 */

export class Credentials {
  constructor(argv) {
    cleanupSecretsFile();
    this.profile = argv.profile;
    this.logger = container.resolve("logger");

    this.ttlMs = argv.ttlMs || TTL_DEFAULT_MS;
    // TODO: consider separate classes for the stores and the operations
    //   e.g. AccountKeys and SecretKeys do the refreshing/creating and
    //    AccountKeyStore and SecretKeyStore do the file operations
    const { database, role } = argv;
    this.dbKeyName = Credentials.getDBKeyName(database, role);
    this.accountKeys = new AccountKeyStorage(this.profile);
    const storedAccountKey = this.accountKeys.get()?.accountKey;
    this.dbKeys = new SecretKeyStorage(storedAccountKey);

    const storedDBKey = this.dbKeys.get(this.dbKeyName)?.secret;

    let { dbKey, dbKeySource, accountKey, accountKeySource } =
      resolveCredentials(argv, storedAccountKey, storedDBKey);

    // Let users know if the creds they provided are invalid (empty)
    if (!accountKey && accountKeySource !== "credentials-file") {
      throw new Error(
        `The account key provided by ${accountKeySource} is invalid. Please provide an updated value.`,
      );
    }

    if (!dbKey && dbKeySource !== "credentials-file") {
      throw new Error(
        `The database secret provided by ${dbKeySource} is invalid. Please provide an updated secret.`,
      );
    }

    // dbKey and accountKey are not guaranteed to be defined or valid after the constructor is done.
    //   Validity will ultimately be determined during the account api and fauna api calls.
    this.accountKey = accountKey;
    this.dbKey = dbKey;
    this.accountKeySource = accountKeySource;
    this.dbKeySource = dbKeySource;

    this.logger.debug(
      `created credentials class ${JSON.stringify(this.accountKeys.get())} ${JSON.stringify(this.dbKeys.get())}`,
      "creds",
    );
  }

  async login(accessToken) {
    const { accountKey, refreshToken } =
      await FaunaAccountClient.getSession(accessToken);
    this.accountKeys.save({
      accountKey,
      refreshToken,
      // TODO: set expiration
      // expiresAt: Credentials.getKeyExpiration(),
    });
    this.accountKey = accountKey;
  }

  promptLogin() {
    const exit = container.resolve("exit");
    this.logger.stderr(
      `The requested profile ${this.profile || ""} is not signed in or has expired.\nPlease re-authenticate`,
    );
    this.logger.stdout(`To sign in, run:\n\nfauna login\n`);
    exit(1);
  }

  // This method guarantees settings this.dbKey to a valid key
  async onInvalidFaunaCreds() {
    if (this.dbKeySource !== "credentials-file") {
      throw new Error(
        `Secret provided by ${this.dbKeySource} is invalid. Please provide an updated secret.`,
      );
    }
    await this.refreshDBKey();
  }
  async onInvalidAccountCreds() {
    if (this.accountKeySource !== "credentials-file") {
      throw new Error(
        `Account key provided by ${this.accountKeySource} is invalid. Please provide an updated account key.`,
      );
    }
    await this.refreshSession();
  }

  getKeyExpiration() {
    return Date.now() + this.ttlMs;
  }

  // a name used to index the stored db and account keys
  static getDBKeyName(path, role) {
    return `${path}:${role}`;
  }

  /**
   * Gets the currently active db key. If it's local and it's expired,
   *   refreshes it and returns it.
   * @returns {string} - The db key
   */
  async getOrRefreshDBKey() {
    if (this.dbKeySource === "credentials-file") {
      const key = this.dbKeys.get(this.dbKeyName);
      if (!key || key.expiresAt < Date.now()) {
        this.logger.debug(
          "Found db key, but it is expired. Refreshing...",
          "creds",
        );
        await this.refreshDBKey(this.dbKeyName);
      } else {
        this.dbKey = key.secret;
      }
    }
    return this.dbKey;
  }

  /**
   * Calls account api to create a new key and saves it to the file.
   * @returns {string} - The new secret
   */
  async refreshDBKey() {
    this.logger.debug(`Creating new db key for ${this.dbKeyName}`, "creds");
    const [path, role] = this.dbKeyName.split(":");
    const expiration = this.getKeyExpiration();
    const accountClient = container.resolve("accountClient");
    const newSecret = await this.accountClient.createKey({
      path,
      role,
      ttl: new Date(expiration).toISOString(),
    });
    this.dbKeys.save(this.dbKeyName, {
      secret: newSecret.secret,
      expiresAt: expiration,
    });
    this.dbKey = newSecret.secret;
    return newSecret.secret;
  }

  /**
   * Gets the currently active account key. If it's local and it's expired,
   * refreshes it and returns it.
   * @returns {string} - The account key
   */
  async getOrRefreshAccountKey() {
    if (this.accountKeySource === "credentials-file") {
      const key = this.accountKeys.get();
      // TODO: track ttl for account and refresh keys
      if (!key || (key.expiresAt && key.expiresAt < Date.now())) {
        this.logger.debug(
          "Found account key, but it is expired. Refreshing...",
          "creds",
        );
        await this.refreshSession();
      } else {
        this.accountKey = key.accountKey;
      }
    }
    return this.accountKey;
  }

  /**
   * Uses the local refresh token to get a new account key and saves it to the
   * credentials file. Updates this.accountKey to the new value

   */
  async refreshSession() {
    const existingCreds = this.accountKeys.get();
    if (!existingCreds?.refreshToken) {
      this.promptLogin();
    }
    try {
      const newAccountCreds = await FaunaAccountClient.refreshSession(
        existingCreds.refreshToken,
      );
      this.accountKeys.save({
        accountKey: newAccountCreds.accountKey,
        refreshToken: newAccountCreds.refreshToken,
      });
      this.accountKey = newAccountCreds.accountKey;
      // Update the account key used to access secrets in local storage
      this.dbKeys.updateAccountKey(newAccountCreds.accountKey);
    } catch (e) {
      if (e instanceof InvalidCredsError) {
        this.promptLogin();
      } else {
        throw e;
      }
    }
  }

  // AccountClient depends on an instance of Credentials. Initialize it here to avoid circular dependencies.
  // init() {
  //   this.accountClient = new (container.resolve("AccountClient"))(this.profile);
  // }
}

/**
 * Build a credentials singleton based on the command line options provided
 * @param {*} argv
 * @returns {Credentials}
 */
export function buildCredentials(argv) {
  const credentials = new Credentials(argv);
  const accountClient = new FaunaAccountClient(credentials.profile);
  container.register({
    credentials: asValue(credentials, { lifetime: Lifetime.SINGLETON }),
    accountClient: asValue(accountClient, { lifetime: Lifetime.SINGLETON }),
  });
}
