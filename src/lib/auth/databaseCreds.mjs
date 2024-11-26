import { container } from "../../cli.mjs";
import { SecretKeyStorage } from "../file-util.mjs";

const TTL_DEFAULT_MS = 1000 * 60 * 15; // 15 minutes

const resolveDBCreds = (argv, storedDBKey) => {
  let dbKey, dbKeySource;

  // argv.secret come from flag, config, or FAUNA_SECRET
  if (argv.secret) {
    dbKey = argv.secret;
    dbKeySource = "user";
  } else {
    dbKey = storedDBKey;
    dbKeySource = "credentials-file";
  }
  return {
    dbKey,
    dbKeySource,
  };
};

export class DatabaseCreds {
  constructor(argv, accountKey) {
    const { database, role } = argv;
    this.dbKeyName = DatabaseCreds.getDBKeyName(database, role);
    this.dbKeyStore = new SecretKeyStorage(accountKey);
    this.ttlMs = TTL_DEFAULT_MS;
    const storedDBKey = this.dbKeyStore.get(this.dbKeyName)?.secret;
    const { dbKey, dbKeySource } = resolveDBCreds(argv, storedDBKey);
    this.dbKey = dbKey;
    this.dbKeySource = dbKeySource;
    this.logger = container.resolve("logger");

    if (!dbKey && dbKeySource !== "credentials-file") {
      throw new Error(
        `The database secret provided by ${dbKeySource} is invalid. Please provide an updated secret.`,
      );
    }
  }

  /**
   * Update the account key used to access the secrets in the credentials storage
   * @param {string} accountKey
   */
  updateAccountKey(accountKey) {
    this.dbKeyStore.updateAccountKey(accountKey);
  }

  getKeyExpiration() {
    return Date.now() + this.ttlMs;
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
      const key = this.dbKeyStore.get(this.dbKeyName);
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
    const newSecret = await accountClient.createKey({
      path,
      role,
      ttl: new Date(expiration).toISOString(),
    });
    this.dbKeyStore.save(this.dbKeyName, {
      secret: newSecret.secret,
      expiresAt: expiration,
    });
    this.dbKey = newSecret.secret;
    return newSecret.secret;
  }
}
