import fs from "node:fs";

import yaml from "yaml";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { container } from "../../cli.mjs";

/** @type {yaml.Document.Parsed<Record<string, any>>} */
export function getConfig(path) {
  const fileBody = fs.readFileSync(path, { encoding: "utf8" });
  return yaml.parseDocument(fileBody);
}

let parsedProfile;
export function configParser(path) {
  const logger = container.resolve("logger");

  if (parsedProfile) return parsedProfile;

  logger.debug(`Reading config from ${path}...`, "config");
  const config = getConfig(path);
  const argv = yargs(hideBin(process.argv)).options({
    profile: {
      default: "default",
    },
  }).argv;
  logger.debug(`Using profile ${argv.profile}...`, "config");
  parsedProfile = config.toJSON()[argv.profile];
  logger.debug(`Applying config: ${JSON.stringify(parsedProfile, null, 4)}`);

  return parsedProfile;
}
