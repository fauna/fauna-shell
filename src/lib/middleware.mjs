//@ts-check

import { readFileSync } from "node:fs";
import path from "node:path";
import { isSea } from "node:sea";
import { fileURLToPath } from "node:url";

import { container } from "../cli.mjs";
import { fixPath } from "../lib/file-util.mjs";

export function logArgv(argv) {
  const logger = container.resolve("logger");
  logger.debug(JSON.stringify(argv, null, 4), "argv", argv);
  return argv;
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
 * @returns {void}
*/
export function applyLocalArg(argv) {
  const logger = container.resolve("logger");
  if (!argv.url) {
    if (argv.local) {
      argv.url = 'http://localhost:8443';
      logger.debug("Set url to 'http://localhost:8443' as --local was given and --url was not", "argv", argv);
    } else {
      argv.url = 'https://db.fauna.com';
      logger.debug("Defaulted url to 'https://db.fauna.com' no --url was provided", "argv", argv);
    }
  }
  if (!argv.secret && argv.local) {
    argv.secret = "secret";
    logger.debug("Set secret to 'secret' as --local was given and --secret was not", "argv", argv);
  }
}
