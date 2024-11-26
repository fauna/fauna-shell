import { container } from "../../cli.mjs";
import { FaunaAccountClient } from "../fauna-account-client.mjs";
import { AccountKeyStorage } from "../file-util.mjs";
import { InvalidCredsError } from "../misc.mjs";

const resolveAccountCreds = (argv, storedAccountKey) => {
  let accountKey, accountKeySource;
  // argv.accountKey can come from flag, config, or FAUNA_ACCOUNT_KEY
  if (argv.accountKey) {
    accountKey = argv.accountKey;
    accountKeySource = "user";
  } else {
    accountKey = storedAccountKey;
    accountKeySource = "credentials-file";
  }
  return {
    accountKey,
    accountKeySource,
  };
};

export class AccountCreds {
  constructor(argv) {
    this.profile = argv.profile;
    this.accountKeyStore = new AccountKeyStorage(this.profile);
    const storedAccountKey = this.accountKeyStore.get()?.accountKey;
    const { accountKey, accountKeySource } = resolveAccountCreds(
      argv,
      storedAccountKey,
    );
    this.accountKey = accountKey;
    this.accountKeySource = accountKeySource;

    // Let users know if the creds they provided are invalid (empty)
    if (!accountKey && accountKeySource !== "credentials-file") {
      throw new Error(
        `The account key provided by ${accountKeySource} is invalid. Please provide an updated value.`,
      );
    }
  }
  async login(accessToken) {
    const { accountKey, refreshToken } =
      await FaunaAccountClient.getSession(accessToken);
    this.accountKeyStore.save({
      accountKey,
      refreshToken,
      // TODO: set expiration
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
  async onInvalidAccountCreds() {
    if (this.accountKeySource !== "credentials-file") {
      throw new Error(
        `Account key provided by ${this.accountKeySource} is invalid. Please provide an updated account key.`,
      );
    }
    await this.refreshSession();
  }
  /**
   * Gets the currently active account key. If it's local and it's expired,
   * refreshes it and returns it.
   * @returns {string} - The account key
   */
  async getOrRefreshAccountKey() {
    if (this.accountKeySource === "credentials-file") {
      const key = this.accountKeyStore.get();
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
    const existingCreds = this.accountKeyStore.get();
    if (!existingCreds?.refreshToken) {
      this.promptLogin();
    }
    try {
      const newAccountCreds = await FaunaAccountClient.refreshSession(
        existingCreds.refreshToken,
      );
      this.accountKeyStore.save({
        accountKey: newAccountCreds.accountKey,
        refreshToken: newAccountCreds.refreshToken,
      });
      this.accountKey = newAccountCreds.accountKey;
      // Update the account key used to access secrets in local storage
      const databaseCreds = container.resolve("databaseCreds");
      databaseCreds.updateAccountKey(newAccountCreds.accountKey);
    } catch (e) {
      if (e instanceof InvalidCredsError) {
        this.promptLogin();
      } else {
        throw e;
      }
    }
  }
}
