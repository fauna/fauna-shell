import { exit } from "node:process";

import * as awilix from "awilix/lib/awilix.module.mjs";

import { performQuery } from "../yargs-commands/eval.mjs";
import logger from "../lib/logger.mjs";
import { getSimpleClient } from "../lib/command-helpers.mjs";
import {
  gatherFSL,
  gatherRelativeFSLFilePaths,
  getStagedSchemaStatus,
  getSchemaFiles,
} from "../lib/schema.mjs";
import { confirm } from "@inquirer/prompts";
import fetchWrapper from "../lib/fetch-wrapper.mjs";
import { FaunaAccountClient } from "../lib/fauna-account-client.mjs";
import open from "open";
import OAuthClient from "../lib/auth/oauth-client.mjs";
import { Lifetime } from "awilix";

// import { findUpSync } from 'find-up'
// import fs from 'node:fs'
// const __dirname = import.meta.dirname;
// export const configPath = findUpSync(['dice.json'], { cwd: __dirname })
// export const config = configPath ? JSON.parse(fs.readFileSync(configPath)) : {}

export function setupCommonContainer() {
  const container = awilix.createContainer({
    injectionMode: awilix.InjectionMode.PROXY,
    strict: true,
  });

  return container;
}

export const injectables = {
  // node libraries
  fetch: awilix.asValue(fetchWrapper),
  exit: awilix.asValue(exit),

  // third-party libraries
  confirm: awilix.asValue(confirm),
  open: awilix.asValue(open),

  // generic lib (homemade utilities)
  logger: awilix.asValue(logger),
  performQuery: awilix.asValue(performQuery),
  getSimpleClient: awilix.asValue(getSimpleClient),
  accountClient: awilix.asClass(FaunaAccountClient, {
    lifetime: Lifetime.SCOPED,
  }),
  oauthClient: awilix.asClass(OAuthClient, { lifetime: Lifetime.SCOPED }),

  // feature-specific lib (homemade utilities)
  gatherFSL: awilix.asValue(gatherFSL),
  gatherRelativeFSLFilePaths: awilix.asValue(gatherRelativeFSLFilePaths),
  getSchemaFiles: awilix.asValue(getSchemaFiles),
  getStagedSchemaStatus: awilix.asValue(getStagedSchemaStatus),
};

export function setupRealContainer() {
  const container = setupCommonContainer();

  container.register(injectables);

  return container;
}
