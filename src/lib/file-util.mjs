//@ts-check

import fs from "node:fs";
import os from "node:os";

import { container } from "../cli.mjs";

/**
 * Fixes paths by normalizing them (.. => parent directory) and resolving ~ to homedir.
 * @param {string} path - The path to fix.
 * @returns {string}
 */
export function fixPath(path) {
  const normalize = container.resolve("normalize");
  const homedir = container.resolve("homedir");
  return normalize(path.replace(/^~/, homedir));
}

/**
 * @function dirExists
 * @param {string} path - The path to check existence for.
 * @returns {boolean}
 */
export function dirExists(path) {
  const stat = fs.statSync(fixPath(path), {
    // returns undefined instead of throwing if the file doesn't exist
    throwIfNoEntry: false,
  });
  if (stat === undefined || !stat.isDirectory()) {
    return false;
  } else {
    return true;
  }
}

/**
 * @function dirIsWriteable
 * @param {string} path - The path to check existence for.
 * @returns {boolean}
 */
export function dirIsWriteable(path) {
  try {
    fs.accessSync(fixPath(path), fs.constants.W_OK);
  } catch (e) {
    return false;
  }

  return true;
}

/**
 * Checks if a file exists at the given path.
 *
 * @param {string} path - The path to the file.
 * @returns {boolean} - Returns true if the file exists, otherwise false.
 */
function fileExists(path) {
  try {
    fs.readFileSync(fixPath(path));
    return true;
  } catch (e) {
    return false;
  }
}

/**
 *
 * @param {string} path - The path to the file.
 * @returns {Object.<string, any>} - The parsed JSON content of the file.
 */
function getJSONFileContents(path) {
  // Open file for reading and writing without truncating
  const fileContent = fs.readFileSync(path, { flag: "r+" }).toString();
  if (!fileContent) {
    return {};
  }
  if (!isJSON(fileContent)) {
    throw new Error(`Credentials file at ${path} contains invalid formatting.`);
  }
  const parsed = JSON.parse(fileContent);
  return parsed;
}

export class CredsNotFoundError extends Error {
  /**
   *
   * @param {"account" | "database"} [invalidAccessor]
   */
  constructor(invalidAccessor = "account") {
    super(invalidAccessor);
    this.name = "CredsNotFoundError";
    this.message = `No secret found for the provided ${invalidAccessor}`;
  }
}

/**
 * Class representing credentials management.
 */
export class CredentialsStorage {
  /**
   * Creates an instance of Credentials.
   *
   * @param {string} [filename=""] - The name of the credentials file.
   */
  constructor(filename = "") {
    this.filename = filename;
    this.credsDir = `${os.homedir()}/.fauna/credentials`;
    if (!dirExists(this.credsDir)) {
      fs.mkdirSync(this.credsDir, { recursive: true });
    }
    this.filepath = `${this.credsDir}/${this.filename}`;
    if (!fileExists(this.filepath)) {
      fs.writeFileSync(this.filepath, "{}");
    }
  }

  getFile() {
    return getJSONFileContents(this.filepath);
  }

  setFile(contents) {
    fs.writeFileSync(this.filepath, JSON.stringify(contents, null, 2));
  }

  /**
   * Retrieves the data from the local credentials file
   * @param {string} key - The key to retrieve from the file
   * @returns {Object.<string, any> | undefined} - The value associated with the key
   */
  get(key) {
    const parsed = this.getFile();
    return parsed[key];
  }

  /**
   * Saves the credentials to the file.
   * @param {string} key - The key to index the creds under
   * @param {Object} value - The value to save.
   */
  save(key, value) {
    try {
      const content = this.getFile();
      content[key] = value;
      this.setFile(content);
    } catch (err) {
      throw new Error(`Error while saving credentials: ${err}`);
    }
  }

  delete(key) {
    const content = this.get(key);
    if (content?.[key]) {
      delete content[key];
      this.setFile(content);
      return true;
    }
    return false;
  }

  clear() {
    this.setFile({});
    return true;
  }
}

/**
 * Class representing secret key management.
 * Accessor methods for the secret keys file that is always scoped to a specific account key
 * @extends CredentialsStorage
 */
export class SecretKeyStorage extends CredentialsStorage {
  /**
   * Creates an instance of SecretKey.
   * @param {string} accountKey - The account key used to index the secrets created by that account key.
   */
  constructor(accountKey) {
    super("secret_keys");
    this.accountKey = accountKey;
  }

  /**
   * Update the account key used to access the secrets in the credentials.
   *   This is helpful for when we have to update an account key on the fly, and want
   *   to continue to use the same instance of SecretKeyStorage.
   * @param {string} accountKey - the new account key to use
   */
  updateAccountKey(accountKey) {
    this.accountKey = accountKey;
  }

  /**
   *
   * @param {string} key - The databasePath:role used to find the secret
   * @returns {Object.<string, any> | undefined} credentialsObject - The value associated with the key, or the entire parsed content if no key is provided.
   */
  get(key) {
    const secrets = this.getAllDBKeysForAccount();
    if (!secrets) {
      return undefined;
    }
    return secrets[key];
  }

  /**
   *
   * @returns {Object.<string, any> | undefined} - The list of all database keys associated with the account key.
   */
  getAllDBKeysForAccount() {
    const secrets = this.getFile();
    const dbKeysForAccountKey = secrets[this.accountKey];
    return dbKeysForAccountKey;
  }

  /**
   *
   * @param {string} key - The path:role name used to index the secret.
   * @param {Object} value - The credentials to save.
   * @param {string} value.secret - The secret to save.
   * @param {string} value.expiresAt - The TTL for the secret
   */

  save(key, value) {
    try {
      const existing = this.getFile();
      const secrets = this.getAllDBKeysForAccount();
      const newContent = {
        ...existing,
        [this.accountKey]: {
          ...secrets,
          [key]: value,
        },
      };
      this.setFile(newContent);
    } catch (err) {
      err.message = `Error while saving credentials: ${err.message}`;
      throw err;
    }
  }

  /**
   *
   * @param {string} key the path:role name used to index the secret
   * @returns
   */
  delete(key) {
    const existing = this.getFile();
    const secrets = this.getAllDBKeysForAccount();
    if (secrets?.[key]) {
      delete secrets[key];
      this.setFile({
        ...existing,
        [this.accountKey]: secrets,
      });
      return true;
    }
    return false;
  }

  /**
   *
   * @returns {boolean} - Returns true if the operation was successful, otherwise false.
   */
  deleteAllDBKeysForAccount() {
    const secrets = this.getFile();
    if (secrets[this.accountKey]) {
      delete secrets[this.accountKey];
      this.setFile(secrets);
      return true;
    }
    return false;
  }
}

/**
 * Class representing account key management.
 * @extends CredentialsStorage
 */
export class AccountKeyStorage extends CredentialsStorage {
  /**
   * Creates an instance of AccountKey.
   * @param {string} profile - The profile used to index the account keys.
   */
  constructor(profile) {
    super("access_keys");
    this.profile = profile;
  }

  /**
   *
   * @returns { Object<"refreshToken" | "accountKey", string> } The account key and refresh token.
   */
  get() {
    return super.get(this.profile);
  }

  save(value) {
    super.save(this.profile, value);
  }

  /**
   * Delete the account key associated with the profile.
   * @returns {boolean} - Returns true if the operation was successful, otherwise false.
   */
  delete() {
    return super.delete(this.profile);
  }
}

/**
 * Steps through account keys in local filesystem and if they are not found in the secrets file,
 *   delete the stale entries on the secrets file.
 */
export function cleanupSecretsFile() {
  const accountKeyData = new CredentialsStorage("access_keys").getFile();
  const accountKeys = Object.values(accountKeyData).map(
    (value) => value.accountKey,
  );
  const secretKeyData = new CredentialsStorage("secret_keys").getFile();
  Object.keys(secretKeyData).forEach((accountKey) => {
    if (!accountKeys.includes(accountKey)) {
      const secretKeyStorage = new SecretKeyStorage(accountKey);
      secretKeyStorage.deleteAllDBKeysForAccount();
    }
  });
}

/**
 * Checks if a value is a valid JSON string.
 *
 * @param {string} value - The value to check.
 * @returns {boolean} - Returns true if the value is a valid JSON string, otherwise false.
 */
function isJSON(value) {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}
