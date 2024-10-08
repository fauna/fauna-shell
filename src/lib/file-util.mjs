//@ts-check

import fs from "node:fs";
import { normalize } from "node:path";
import * as os from "node:os";
import { container } from "../cli.mjs";

// path: string, returns boolean
export function dirExists(path) {
  // TODO: needs to resolve home dir (~); node path libs won't do that for us
  const stat = fs.statSync(normalize(path), {
    // returns undefined instead of throwing if the file doesn't exist
    throwIfNoEntry: false,
  });
  if (stat === undefined || !stat.isDirectory()) {
    return false;
  } else {
    return true;
  }
}

// path: string, returns boolean
export function dirIsWriteable(path) {
  try {
    fs.accessSync(path, fs.constants.W_OK);
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
    fs.readFileSync(path);
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
    this.exit = container.resolve("exit");
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
   * @returns {any} - The value associated with the key, or the entire parsed content if no key is provided.
   */
  get(key) {
    try {
      // Open file for reading and writing without truncating
      const fileContent = fs
        .readFileSync(this.filepath, { flag: "r+" })
        .toString();
      if (!isJSON(fileContent)) {
        this.logger.stderr(
          "Credentials file contains invalid formatting: ",
          this.filepath
        );
        this.exit(1);
      }
      const parsed = JSON.parse(fileContent);
      return key ? parsed[key] : parsed;
    } catch (err) {
      this.logger.stderr(
        "Error while parsing credentials file: ",
        this.filepath,
        err
      );
      this.exit(1);
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
      this.logger.stderr("Error while saving credentials: ", err);
      this.exit(1);
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
