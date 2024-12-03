import { container } from "../../cli.mjs";
import { FaunaAccountClient } from "../fauna-account-client.mjs";
import { SecretKeyStorage } from "../file-util.mjs";

const TTL_DEFAULT_MS = 1000 * 60 * 15; // 15 minutes
const DEFAULT_ROLE = "admin";

/**
 * Class representing the database key(s) available to the user.
 * This class is scoped to a specific account key, as each command invocation will correlate
 * 1:1 with an account key. The account key determines how we access the local credentials file.
 *
 * Keeps track of local keys in this.keyStore, used for getting and saving to/from the filesystem.
 * this.key is the currently active db key, it stays updated after refreshes
 */
export class DatabaseKeys {
  constructor(argv, accountKey) {
    const { database } = argv;
    this.role = argv.role || DEFAULT_ROLE;
    this.keyName = DatabaseKeys.getKeyName(database, this.role);
    this.keyStore = new SecretKeyStorage(accountKey);
    this.ttlMs = TTL_DEFAULT_MS;

    const storedKey = this.keyStore.get(this.keyName)?.secret;
    const { key, keySource } = DatabaseKeys.resolveKeySources(argv, storedKey);
    this.key = key;
    this.keySource = keySource;
    this.logger = container.resolve("logger");
    if (this.keySource !== "credentials-file") {
      // Provided secret carries a role assignment already
      this.role = undefined;
    }

    if (!key && keySource !== "credentials-file") {
      throw new Error(
        `The database secret provided by ${keySource} is invalid. Please provide an updated secret.`,
      );
    }
  }

  /**
   * Evaluates the dbKey to use for this instance, based on priority order
   * @param {Object} argv yargs arguments
   * @param {string | undefined} storedKey The database key stored in the credentials file
   * @returns
   */
  static resolveKeySources(argv, storedKey) {
    let key, keySource;
    // argv.secret comes from flag, config, or FAUNA_SECRET
    if (argv.secret) {
      key = argv.secret;
      keySource = "user";
    } else {
      key = storedKey;
      keySource = "credentials-file";
    }
    return {
      key,
      keySource,
    };
  }

  /**
   * Update the account key used to access the secrets in the credentials storage
   * @param {string} accountKey
   */
  updateAccountKey(accountKey) {
    this.keyStore.updateAccountKey(accountKey);
  }

  getKeyExpiration() {
    return Date.now() + this.ttlMs;
  }

  // This method guarantees settings this.dbKey to a valid key
  async onInvalidCreds() {
    if (this.keySource !== "credentials-file") {
      throw new Error(
        `Secret provided by ${this.keySource} is invalid. Please provide an updated secret.`,
      );
    }
    await this.refreshKey();
  }

  // a name used to index the stored db and account keys
  static getKeyName(path, role) {
    return `${path}:${role}`;
  }
  /**
   * Gets the currently active db key. If it's local and it's expired,
   *   refreshes it and returns it.
   * @returns {string} - The db key
   */
  async getOrRefreshKey() {
    if (this.keySource === "credentials-file") {
      const key = this.keyStore.get(this.keyName);
      if (!key || key.expiresAt < Date.now()) {
        this.logger.debug(
          "Found db key, but it is expired. Refreshing...",
          "creds",
        );
        await this.refreshKey(this.keyName);
      } else {
        this.key = key.secret;
      }
    }
    return this.key;
  }

  /**
   * Calls account api to create a new key and saves it to the file.
   * @returns {string} - The new secret
   */
  async refreshKey() {
    this.logger.debug(`Creating new db key for ${this.keyName}`, "creds");
    const [path, role] = this.keyName.split(":");
    const expiration = this.getKeyExpiration();
    const accountClient = new FaunaAccountClient();
    const newSecret = await accountClient.createKey({
      path,
      role,
      ttl: new Date(expiration).toISOString(),
    });
    this.keyStore.save(this.keyName, {
      secret: newSecret.secret,
      expiresAt: expiration,
    });
    this.key = newSecret.secret;
    return newSecret.secret;
  }
}
