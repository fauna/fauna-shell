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
 * Class representing credentials management.
 */
export class Credentials {
  /**
   * Creates an instance of Credentials.
   *
   * @param {string} [filename=""] - The name of the credentials file.
   */
  constructor(filename = "") {
    this.logger = container.resolve("logger");
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

  /**
   * Retrieves the value associated with the given key from the credentials file.
   *
   * @param {string} [key] - The key to retrieve the value for.
   * @returns {Object.<string, any>} credentialsObject - The value associated with the key, or the entire parsed content if no key is provided.
   */
  get(key) {
    try {
      // Open file for reading and writing without truncating
      const fileContent = fs
        .readFileSync(this.filepath, { flag: "r+" })
        .toString();
      if (!isJSON(fileContent)) {
        throw new Error(
          `Credentials file at ${this.filepath} contains invalid formatting.`
        );
      }
      const parsed = JSON.parse(fileContent);
      return key ? parsed[key] : parsed;
    } catch (err) {
      throw new Error(
        `Error while parsing credentials file at ${this.filepath}: ${err}`
      );
    }
  }

  /**
   * Saves the credentials to the file.
   *
   * @param {Object} params - The parameters for saving credentials.
   * @param {Record<string, string>} params.creds - The credentials to save.
   * @param {boolean} [params.overwrite=false] - Whether to overwrite existing credentials.
   * @param {string} params.profile - The profile name to save the credentials under.
   */
  save({ creds, overwrite = false, profile }) {
    try {
      const existingContent = overwrite ? {} : this.get();
      const newContent = {
        ...existingContent,
        [profile]: creds,
      };
      fs.writeFileSync(this.filepath, JSON.stringify(newContent, null, 2));
    } catch (err) {
      throw new Error(`Error while saving credentials: ${err}`);
    }
  }
}

/**
 * Class representing secret key management.
 * @extends Credentials
 */
export class SecretKey extends Credentials {
  /**
   * Creates an instance of SecretKey.
   */
  constructor() {
    super("secret_keys");
  }
}

/**
 * Class representing account key management.
 * @extends Credentials
 */
export class AccountKey extends Credentials {
  /**
   * Creates an instance of AccountKey.
   */
  constructor() {
    super("access_keys");
  }
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
