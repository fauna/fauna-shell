//@ts-check

import { readFileSync } from "node:fs";
import path from "node:path";
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
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const packagePath = path.join(__dirname, "../../package.json");
  const updateNotifier = container.resolve("updateNotifier");

  const notifier = updateNotifier({
    pkg: JSON.parse(readFileSync(packagePath, { encoding: "utf-8" })),
    updateCheckInterval: 1000 * 60 * 60 * 24 * 7, // 1 week
  });

  notifier.notify();
  return argv;
}
