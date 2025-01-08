// @ts-check

import * as path from "node:path";

import { container } from "../cli.mjs";
import { setAccountUrl } from "./account-api.mjs";
import { buildCredentials } from "./auth/credentials.mjs";
import { getConfig, locateConfig } from "./config/config.mjs";

export function getProfileCompletions(currentWord, argv) {
  const configPath = locateConfig(path.resolve(argv.config));
  if (!configPath) return undefined;
  return Object.keys(getConfig(configPath).toJSON());
}

export async function getDbCompletions(currentWord, argv) {
  const regionGroups = ["us-std", "eu-std", "global"];

  function getRegionGroup(currentWord) {
    const rg = regionGroups.filter((rg) => currentWord.startsWith(rg));
    return rg.length ? rg[0] : undefined;
  }

  if (!getRegionGroup(currentWord)) {
    return regionGroups;
  } else {
    const { pageSize } = argv;
    if (argv.accountUrl !== undefined) {
      setAccountUrl(argv.accountUrl);
    }
    buildCredentials({ ...argv, user: "default" });
    const { listDatabases } = container.resolve("accountAPI");
    try {
      // Try the currentWord with any trailing slash removed
      const databasePath = currentWord.endsWith("/")
        ? currentWord.slice(0, -1)
        : currentWord;
      const response = await listDatabases({
        pageSize,
        path: databasePath,
      });
      return response.results.map(({ name }) => path.join(currentWord, name));
    } catch (e) {
      // If the first try fails, try the currentWord with the directory name.
      // If this is just a region group, dirname will resolve to '.' and we'll
      // not get any results.
      const databasePath = path.dirname(currentWord);
      const response = await listDatabases({
        pageSize,
        path: databasePath,
      });
      return response.results.map(({ name }) =>
        path.join(path.dirname(currentWord), name),
      );
    }
  }
}
