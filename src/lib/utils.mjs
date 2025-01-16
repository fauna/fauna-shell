import { container } from "../config/container.mjs";
import { Format } from "./formatting/colorize.mjs";

export function isTTY() {
  return process.stdout.isTTY;
}

export const resolveFormat = (argv) => {
  const logger = container.resolve("logger");

  if (argv.json) {
    logger.debug(
      "--json has taken precedence over other formatting options, using JSON output",
      "argv",
    );
    return Format.JSON;
  }

  return argv.format;
};

/**
 * Standardizes the region of a database path.
 *
 * @param {string | undefined} databasePath - The database path to standardize.
 * @returns {string | undefined} The standardized database path.
 * @throws {TypeError} If the database path is not a string.
 */
export function standardizeRegion(databasePath) {
  if (!databasePath) return databasePath;
  if (typeof databasePath !== "string") {
    throw new TypeError("Database path must be a string");
  }

  const trimmed = databasePath.replace(/^\/|\/$/g, "");
  const parts = trimmed.split("/");
  const region = parts[0].toLowerCase();
  const rest = parts.slice(1).join("/");

  const regionMap = {
    us: "us-std",
    eu: "eu-std",
    classic: "global",
  };

  const standardRegion = regionMap[region] || region;
  return rest ? `${standardRegion}/${rest}` : standardRegion;
}

/**
 * @param {number} ms - The number of milliseconds to sleep.
 * @returns {Promise<void>} A promise that resolves after the specified number of milliseconds.
 */
export async function sleep(ms) {
  return await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
