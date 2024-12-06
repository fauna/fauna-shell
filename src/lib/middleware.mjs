//@ts-check

import { readFileSync } from "node:fs";
import path from "node:path";
import { isSea } from "node:sea";
import { fileURLToPath } from "node:url";

import { container } from "../cli.mjs";
import { fixPath } from "../lib/file-util.mjs";

const LOCAL_URL = "http://localhost:8443";
const LOCAL_SECRET = "secret";
const DEFAULT_URL = "https://db.fauna.com";

export function logArgv(argv) {
  const logger = container.resolve("logger");
  logger.debug(JSON.stringify(argv, null, 4), "argv", argv);
  logger.debug(
    `Existing Fauna environment variables: ${captureEnvVars()}`,
    "argv",
  );
  return argv;
}

function captureEnvVars() {
  return JSON.stringify(
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
  // TODO: figure out upgrade path for SEA installations
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
 * @returns {import('yargs').Arguments}
 */
export function applyLocalArg(argv) {
  applyLocalToUrl(argv);
  return applyLocalToSecret(argv);
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
    if (argv.local) {
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
 * @param {import('yargs').Arguments} argv
 * @returns {import('yargs').Arguments}
 */
function applyLocalToSecret(argv) {
  const logger = container.resolve("logger");
  if (!argv.secret && argv.local) {
    if (argv.role && argv.database) {
      argv.secret = `${LOCAL_SECRET}:${argv.database}:${argv.role}`;
    } else if (argv.role) {
      argv.secret = `${LOCAL_SECRET}:${argv.role}`;
    } else if (argv.database) {
      // no role
      argv.secret = `${LOCAL_SECRET}:${argv.database}:admin`;
    } else {
      argv.secret = LOCAL_SECRET;
    }
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
