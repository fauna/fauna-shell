#!/usr/bin/env node

/* eslint no-console: 0 */

import { exec as _exec } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

import * as semver from "semver";

const exec = promisify(_exec);
const __dirname = import.meta.dirname;

const writeOutput = (key, value) => {
  appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
};

const versions = JSON.parse(
  (await exec("npm view fauna-shell versions --json")).stdout,
);
const proposedVersionString = JSON.parse(
  readFileSync(join(__dirname, "../package.json"), { encoding: "utf8" }),
).version;
const proposedVersion = semver.valid(semver.clean(proposedVersionString));
const currentVersion = versions[versions.length - 1];

console.log(`Current published version:    ${currentVersion}`);
console.log(`Proposed version to publish:  ${proposedVersion}`);

if (proposedVersion === null)
  throw new Error(
    `Could not parse proposed version "${proposedVersion}" from package.json as a semantic version.`,
  );

if (versions.includes(proposedVersion))
  throw new Error(
    `Version "${proposedVersion}" from package.json has already been published.`,
  );

if (semver.lt(proposedVersion, currentVersion))
  throw new Error(
    `Version "${proposedVersion}" is a lower semantic version number than the current version "${currentVersion}".`,
  );

console.log(`Passed version check.`);

if (process.env.GITHUB_ACTIONS) {
  writeOutput("do_publish", "true");
  writeOutput("new_version", proposedVersion);
}
