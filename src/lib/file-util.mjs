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

export function fileExists(path) {
  try {
    fs.readFileSync(path);
    return true;
  } catch (e) {
    return false;
  }
}

export class Credentials {
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

export class SecretKey extends Credentials {
  constructor() {
    super("secret_keys");
  }
}

export class AccountKey extends Credentials {
  constructor() {
    super("access_keys");
  }
}

function isJSON(value) {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}
