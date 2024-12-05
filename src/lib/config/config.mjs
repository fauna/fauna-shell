import yaml from "yaml";
import yargsParser from "yargs-parser";

import { container } from "../../cli.mjs";
import { ValidationError } from "../command-helpers.mjs";

export const validDefaultConfigNames = [
  "fauna.config.yaml",
  "fauna.config.yml",
  "fauna.config.json",
  ".fauna.config.yaml",
  ".fauna.config.yml",
  ".fauna.config.json",
];

/**
 * Parses a config file at the given path.
 *
 * @param {string} path
 * @throws {ValidationError} If the config file does not exist.
 * @return {yaml.Document.Parsed<Record<string, any>>}
 */
export function getConfig(path) {
  const fs = container.resolve("fs");
  let fileBody;
  try {
    fileBody = fs.readFileSync(path, { encoding: "utf8" });
  } catch (fsError) {
    if (fsError.code === "ENOENT") {
      throw new ValidationError(`Config file not found at path ${path}.`);
    }

    throw fsError;
  }
  return yaml.parseDocument(fileBody);
}

/**
 * Checks the specified directory for default configuration files.
 *
 * @param {string} path - The path to the directory to search for config files.
 * @throws {ValidationError} If multiple config files with valid default names are found.
 * @returns {string|undefined} - The name of the default config file if found, otherwise undefined.
 */
function checkForDefaultConfig(path) {
  const logger = container.resolve("logger");
  const fs = container.resolve("fs");

  let files = fs.readdirSync(path, { withFileTypes: true, encoding: "utf8" });
  files = files.filter(
    (file) => file.isFile() && validDefaultConfigNames.includes(file.name),
  );
  if (files.length > 1) {
    const names = files.map((file) => file.name).join(", ");
    throw new ValidationError(
      `Multiple config files found with valid default names (${names}). Either specify one with "--config FILENAME" or delete the unused config files.`,
    );
  } else if (files.length === 1) {
    logger.debug(
      `Found default config file named "${files[0].name}". Using it.`,
      "config",
    );
    return files[0].name;
  } else {
    logger.debug(`No default config file found.`, "config");
    return undefined;
  }
}

/**
 * Validate the config profile
 * Checks that the specified profile name exists in the config file.
 *
 * @param {string} profileName - The name of the profile to validate.
 * @param {Record<string, any>} profileBody - The parsed config profile JSON.
 * @param {string} configPath - The path to the config file.
 * @throws {ValidationError} If the profile name is not found in the config file.
 */
function validateConfig(profileName, profileBody, configPath) {
  if (profileName === "default" && !profileBody) {
    throw new ValidationError(
      `No "default" profile found in the config file at "${configPath}". Either specify a profile with "--profile NAME" or add a "default" profile.`,
    );
  }

  if (!profileBody && profileName !== "default") {
    throw new ValidationError(
      `Could not find profile "${profileName}" in config file at ${configPath}.`,
    );
  }
}

/**
 * A parser to convert config files into appropriate command line arguments
 * given existing arguments.
 *
 * @param {string|string[]} argvInput - The raw command line arguments.
 * @param {string} path
 * @returns {object} - The yargs parser
 */
export function configParser(argvInput, path) {
  let parsedPath = path;
  let parsedProfile;
  const logger = container.resolve("logger");

  if (path === process.cwd()) {
    parsedPath = checkForDefaultConfig(process.cwd());
  }

  if (!parsedPath) {
    // if there no config file, we need to assert that no either no profile is
    // specified or that the profile is "default"
    const preConfigArgv = yargsParser(argvInput, {
      alias: {
        profile: ["p"],
      },
      string: ["profile"],
    });
    if (preConfigArgv.profile && preConfigArgv.profile !== "default") {
      throw new ValidationError(
        `Profile "${preConfigArgv.profile}" cannot be specified because there was no config file found at "${path}". ` +
          `Remove the profile, or provide a config file.`,
      );
    }
    return {};
  }

  logger.debug(`Reading config from ${parsedPath}.`, "config");
  const config = getConfig(parsedPath);

  // The "default" profile will be injected here
  const argv = yargsParser(argvInput, {
    alias: {
      profile: ["p"],
    },
    default: {
      profile: "default",
    },
    string: ["profile"],
  });
  logger.debug(`Using profile ${argv.profile}...`, "config");
  parsedProfile = config.toJSON()[argv.profile];

  validateConfig(argv.profile, parsedProfile, parsedPath);

  logger.debug(
    `Applying config: ${JSON.stringify(parsedProfile, null, 4)}`,
    "config",
  );

  return parsedProfile;
}
