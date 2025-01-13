//@ts-check

import { readFileSync } from "node:fs";
import path from "node:path";
import { isSea } from "node:sea";
import { fileURLToPath } from "node:url";

import { container } from "../config/container.mjs";
import { fixPath } from "../lib/file-util.mjs";
import { setAccountUrl } from "./account-api.mjs";
import { ValidationError } from "./errors.mjs";
import { redact, redactedStringify } from "./formatting/redact.mjs";
import { QUERY_OPTIONS } from "./options.mjs";
const LOCAL_URL = "http://0.0.0.0:8443";
const LOCAL_SECRET = "secret";
const DEFAULT_URL = "https://db.fauna.com";

export function logArgv(argv) {
  const logger = container.resolve("logger");
  logger.debug(redactedStringify(argv, null, 4), "argv", argv);
  logger.debug(
    `Existing Fauna environment variables: ${captureEnvVars()}`,
    "argv",
  );
  return argv;
}

function captureEnvVars() {
  return redactedStringify(
    Object.entries(process.env)
      .filter(([key]) => key.startsWith("FAUNA_"))
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {}),
  );
}

export function fixPaths(argv) {
  if (argv.dir) {
    return { ...argv, dir: fixPath(argv.dir) };
  } else {
    return argv;
  }
}

export function checkForUpdates(argv) {
  if (isSea()) return argv;

  const __filename = fileURLToPath(import.meta.url);
  let __dirname = path.dirname(__filename);
  if (__dirname.split(path.sep).pop() === "dist") {
    __dirname = path.normalize(path.join(__dirname, ".."));
  } else {
    __dirname = path.normalize(path.join(__dirname, "../.."));
  }
  const packagePath = path.join(__dirname, "package.json");
  const updateNotifier = container.resolve("updateNotifier");

  const notifier = updateNotifier({
    pkg: JSON.parse(readFileSync(packagePath, { encoding: "utf-8" })),
    updateCheckInterval: 1000 * 60 * 60 * 24 * 7, // 1 week
  });

  notifier.notify();
  return argv;
}

/**
 * Mutates argv appropriately for local Fauna usage
 * (i.e. local container usage). If --local is provided
 * and --url is not, argv.url is set to 'http://localhost:8443'.
 * If --local is provided and --secret is not, argv.secret is
 * set to 'secret'.
 * @param {import('yargs').Arguments} argv
 * @returns {void}
 */
export function applyLocalArg(argv) {
  applyLocalToUrl(argv);
  applyLocalToSecret(argv);
}

/**
 * @param {import('yargs').Arguments} argv
 * @returns {boolean} true if this command acts on a local
 * container, false otherwise.
 */
export function isLocal(argv) {
  return Boolean(argv.local) || argv._[0] === "local";
}

/**
 * Mutates argv.url appropriately for local Fauna usage
 * (i.e. local container usage). If --local is provided
 * and --url is not, argv.url is set to 'http://localhost:8443'.
 * @param {import('yargs').Arguments} argv
 * @returns {import('yargs').Arguments}
 */
function applyLocalToUrl(argv) {
  const logger = container.resolve("logger");
  if (!argv.url) {
    if (isLocal(argv)) {
      argv.url = LOCAL_URL;
      logger.debug(
        `Set url to '${LOCAL_URL}' as --local was given and --url was not`,
        "argv",
        argv,
      );
    } else {
      argv.url = DEFAULT_URL;
      logger.debug(
        `Defaulted url to '${DEFAULT_URL}' no --url was provided`,
        "argv",
        argv,
      );
    }
  }
  return argv;
}

/**
 * Mutates argv.secret appropriately for local Fauna usage
 * (i.e. local container usage). If --local is provided
 * and --secret is not, argv.secret is set to 'secret'.
 * Additionally, if --local and --database are provided
 * the secret is scoped to the database. If --local and
 * --role are provided the secret is scoped to the role.
 * @param {import('yargs').Arguments} argv
 * @returns {import('yargs').Arguments}
 */
function applyLocalToSecret(argv) {
  const logger = container.resolve("logger");
  if (!argv.secret && isLocal(argv)) {
    argv.secret = LOCAL_SECRET;
    logger.debug(
      `Set secret to '${argv.secret}' as --local was given, --secret was not, \
--database was ${argv.database ? `'${argv.database}'` : "not"}, and --role \
was ${argv.role ? `'${argv.role}'` : "not"}}`,
      "argv",
      argv,
    );
  }
  return argv;
}

/**
 * Mutates argv.secret appropriately when --database and/or --role are
 * provided along with --secret.
 * @param {import('yargs').Arguments} argv
 * @returns {import('yargs').Arguments}
 */
export function scopeSecret(argv) {
  const logger = container.resolve("logger");
  if (argv.secret) {
    if (argv.database) {
      // If --database path is provided with --secret, scope the secret.
      // A default role must be provided.
      const role = argv.role || "admin";
      argv.secret = `${argv.secret}:${argv.database}:${role}`;

      const debuggableSecret = `${redact(argv.secret)}:${argv.database}:${role}`;

      logger.debug(
        `Applying scope to secret '${debuggableSecret}', since --database was '${argv.database}' ${argv.role ? `with --role '${argv.role}'` : "with default role 'admin'"}`,
        "argv",
        argv,
      );
    } else if (argv.role) {
      // If --role is provided with --secret, scope the secret to the role
      argv.secret = `${argv.secret}:${argv.role}`;

      const debuggableSecret = `${redact(argv.secret)}:${argv.role}`;

      logger.debug(
        `Applying scope to secret '${debuggableSecret}', since --role was '${argv.role}'"`,
        "argv",
        argv,
      );
    }
  }
  return argv;
}

/**
 * Mutates argv.include appropriately for query options
 * @param {Object} argv
 * @param {Array<string>} argv.include
 * @param {boolean} argv.performanceHints
 * @returns {Object}
 */
export function resolveIncludeOptions(argv) {
  if (argv.include.includes("none")) {
    if (argv.include.length !== 1) {
      throw new ValidationError(
        `'--include none' cannot be used with other include options. Provided options: '${argv.include.join(", ")}'`,
      );
    }
    argv.include = [];
  }

  if (argv.include.includes("all")) {
    argv.include = [...QUERY_OPTIONS.include.choices];
  }

  if (argv.performanceHints && !argv.include.includes("summary")) {
    argv.include.push("summary");
  }

  return argv;
}

/**
 * Validate that the user has specified either a database or a secret.
 * This check is not required for commands that can operate at a
 * "root" level.
 *
 * @param {object} argv
 * @param {string} argv.database - The database to use
 * @param {string} argv.secret - The secret to use
 * @param {boolean} argv.local - Whether to use a local Fauna container
 * @param {boolean|undefined} argv.getYargsCompletions - Whether this CLI run is to generate completions
 */
export const validateDatabaseOrSecret = (argv) => {
  // don't validate completion invocations
  if (argv.getYargsCompletions) return true;

  if (!argv.database && !argv.secret && !argv.local) {
    throw new ValidationError(
      "No database or secret specified. Please use either --database, --secret, or --local to connect to your desired Fauna database.",
    );
  }
  return true;
};

/**
 * Set the account URL for the current user, changing the base url used for
 * all Fauna API requests.
 * @param {import('yargs').Arguments} argv
 * @returns {import('yargs').Arguments}
 */
export function applyAccountUrl(argv) {
  if (argv.accountUrl) {
    setAccountUrl(argv.accountUrl);
  }
  return argv;
}
