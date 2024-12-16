// @ts-check

import * as path from "node:path";

import { FaunaAccountClient } from "../lib/fauna-account-client.mjs";
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
    buildCredentials({ ...argv, user: "default" });
    const accountClient = new FaunaAccountClient();
    try {
      const response = await accountClient.listDatabases({
        pageSize,
        path: currentWord,
      });
      return response.results.map(({ name }) => path.join(currentWord, name));
    } catch (e) {
      const response = await accountClient.listDatabases({
        pageSize,
        path: path.dirname(currentWord),
      });
      return response.results.map(({ name }) =>
        path.join(path.dirname(currentWord), name),
      );
    }
  }
}
