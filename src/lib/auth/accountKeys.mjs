import { container } from "../../cli.mjs";
import { FaunaAccountClient } from "../fauna-account-client.mjs";
import { AccountKeyStorage } from "../file-util.mjs";
import { InvalidCredsError } from "../misc.mjs";

/**
 * Class representing the account key(s) available to the user.
 * This class is scoped to a specific profile, as each command invocation will correlate
 * 1:1 with a profile. The profile determines how we access the local credentials file.
 *
 * Keeps track of local keys in this.keyStore, used for getting and saving to/from the filesystem.
 * this.key is the currently active account key, it stays updated after refreshes
 */
export class AccountKeys {
  constructor(argv) {
    this.profile = argv.profile;
    this.keyStore = new AccountKeyStorage(this.profile);
    const storedKey = this.keyStore.get()?.accountKey;
    const { key, keySource } = AccountKeys.resolveKeySources(argv, storedKey);
    this.key = key;
    this.keySource = keySource;

    // Let users know if the creds they provided are invalid (empty)
    if (!key && keySource !== "credentials-file") {
      throw new Error(
        `The account key provided by ${keySource} is invalid. Please provide an updated value.`,
      );
    }
  }

  /**
   * Evaluates the accountKey to use for this instance, based on priority order
   * @param {Object} argv yargs arguments
   * @param {string | undefined} storedKey The account key stored in the credentials file
   * @returns {Object} - The account key and its source
   */
  static resolveKeySources(argv, storedKey) {
    let key, keySource;
    // argv.accountKey can come from flag, config, or FAUNA_ACCOUNT_KEY
    if (argv.accountKey) {
      key = argv.accountKey;
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
   * Prompt re-authentication and exit the program;
   */
  promptLogin() {
    const exit = container.resolve("exit");
    this.logger.stderr(
      `The requested profile ${this.profile || ""} is not signed in or has expired.\nPlease re-authenticate`,
    );
    this.logger.stdout(`To sign in, run:\n\nfauna login\n`);
    exit(1);
  }

  /**
   * Helper method available to the account client to handle invalid account keys.
   *   Exits the program if the invalid account key was user-provided
   */
  async onInvalidCreds() {
    if (this.keySource !== "credentials-file") {
      throw new Error(
        `Account key provided by ${this.keySource} is invalid. Please provide an updated account key.`,
      );
    }
    await this.refreshKey();
  }

  /**
   * Gets the currently active account key. If it's local and it's expired,
   * refreshes it and returns it.
   * @returns {string} - The account key
   */
  async getOrRereshKey() {
    if (this.keySource === "credentials-file") {
      const key = this.keyStore.get();
      // TODO: track ttl for account and refresh keys
      if (!key || (key.expiresAt && key.expiresAt < Date.now())) {
        this.logger.debug(
          "Found account key, but it is expired. Refreshing...",
          "creds",
        );
        await this.refreshKey();
      } else {
        this.key = key.accountKey;
      }
    }
    return this.key;
  }

  /**
   * Uses the local refresh token to get a new account key and saves it to the
   * credentials file. Updates this.key to the new value. If refresh fails, prompts login
   */
  async refreshKey() {
    const existingCreds = this.keyStore.get();
    if (!existingCreds?.refreshToken) {
      this.promptLogin();
    }
    try {
      const newAccountKey = await FaunaAccountClient.refreshSession(
        existingCreds.refreshToken,
      );
      this.keyStore.save({
        accountKey: newAccountKey.accountKey,
        refreshToken: newAccountKey.refreshToken,
      });
      this.key = newAccountKey.accountKey;
      // Update the account key used to access secrets in local storage
      const databaseKeys = container.resolve("credentials").databaseKeys;
      databaseKeys.updateAccountKey(newAccountKey.accountKey);
    } catch (e) {
      if (e instanceof InvalidCredsError) {
        this.promptLogin();
      } else {
        throw e;
      }
    }
  }
}
