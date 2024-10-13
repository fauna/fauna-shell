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

function getJSONFileContents(path) {
  // Open file for reading and writing without truncating
  const fileContent = fs.readFileSync(path, { flag: "r+" }).toString();
  if (!isJSON(fileContent)) {
    throw new Error(`Credentials file at ${path} contains invalid formatting.`);
  }
  const parsed = JSON.parse(fileContent);
  return parsed;
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
   * @param {Object} [opts]
   * @param {string} [opts.key] - The key to retrieve from the credentials file.
   * @returns {Object.<string, any>} credentialsObject - The value associated with the key, or the entire parsed content if no key is provided.
   */
  get(opts) {
    const parsed = getJSONFileContents(this.filepath);
    if (!opts) return parsed;
    const { key } = opts;
    if (!key) {
      throw new InvalidcCredsError("key");
    }
    return parsed?.[key];
  }

  /**
   * Saves the credentials to the file.
   *
   * @param {Object} params - The parameters for saving credentials.
   * @param {Record<string, string>} params.creds - The credentials to save.
   * @param {boolean} [params.overwrite=false] - Whether to overwrite existing credentials.
   * @param {string} params.key - The key to index the creds under
   */
  save({ creds, overwrite = false, key }) {
    try {
      const existingContent = overwrite ? {} : this.get();
      const newContent = {
        ...existingContent,
        [key]: creds,
      };
      fs.writeFileSync(this.filepath, JSON.stringify(newContent, null, 2));
    } catch (err) {
      throw new Error(`Error while saving credentials: ${err}`);
    }
  }
}

export class InvalidcCredsError extends Error {
  /**
   *
   * @param {"key" | "path" | "role"} invalidAccessor
   */
  constructor(invalidAccessor) {
    super(invalidAccessor);
    this.name = "InvalidcCredsError";
    this.message = `No secret found for the provided ${invalidAccessor}`;
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
    this.save = ({ creds, overwrite = false, key }) => {
      try {
        const existingContent = overwrite ? {} : this.get();
        const existingAccountSecrets = existingContent[key] || {};
        const { secret, path, role } = creds;
        const existingPathSecrets = existingContent[key]?.[path] || {};
        const newContent = {
          ...existingContent,
          [key]: {
            ...existingAccountSecrets,
            [path]: {
              ...existingPathSecrets,
              [role]: secret,
            },
          },
        };
        fs.writeFileSync(this.filepath, JSON.stringify(newContent, null, 2));
      } catch (err) {
        err.message = `Error while saving credentials: ${err.message}`;
        throw err;
      }
    };
    /**
     *
     * @param {*} [opts]
     * @returns {Object.<string, any>} credentialsObject - The value associated with the key, or the entire parsed content if no key is provided.
     */
    this.get = (opts) => {
      const secrets = getJSONFileContents(this.filepath);
      if (!opts) return secrets;
      const { key, path, role } = opts;
      const [keyData, pathData, roleData] = [
        secrets?.[key],
        secrets?.[key]?.[path],
        secrets?.[key]?.[path]?.[role],
      ];
      if (role && !roleData) {
        throw new InvalidcCredsError("role");
      }
      if (path && !pathData) {
        throw new InvalidcCredsError("path");
      }
      if (key && !keyData) {
        throw new InvalidcCredsError("key");
      }
      return roleData ?? pathData ?? keyData;
    };
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
