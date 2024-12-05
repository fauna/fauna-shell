//@ts-check

import chalk from "chalk";

import { container } from "../../cli.mjs";
import {
  CommandError,
  yargsWithCommonQueryOptions,
} from "../../lib/command-helpers.mjs";
import { getSecret } from "../../lib/fauna-client.mjs";
import { reformatFSL } from "../../lib/schema.mjs";

async function doStatus(argv) {
  const logger = container.resolve("logger");
  const makeFaunaRequest = container.resolve("makeFaunaRequest");

  let params = new URLSearchParams({ diff: "summary" });
  const secret = await getSecret();
  const gatherFSL = container.resolve("gatherFSL");
  const fsl = reformatFSL(await gatherFSL(argv.dir));

  const statusResponse = await makeFaunaRequest({
    argv,
    path: "/schema/1/staged/status",
    params,
    method: "GET",
    secret,
  });

  params = new URLSearchParams({
    diff: "summary",
    staged: "true",
    version: statusResponse.version,
  });
  const validationResponse = await makeFaunaRequest({
    argv,
    path: "/schema/1/validate",
    params,
    method: "POST",
    body: fsl,
    secret,
  });

  logger.stdout(`Staged changes: ${chalk.bold(statusResponse.status)}`);
  if (statusResponse.pending_summary !== "") {
    logger.stdout(statusResponse.pending_summary);
  }
  if (statusResponse.diff) {
    logger.stdout("Staged changes:\n");
    logger.stdout(statusResponse.diff.split("\n").join("\n  "));
  }

  if (validationResponse.error) {
    logger.stdout(`Local changes:`);
    throw new CommandError(validationResponse.error.message);
  } else if (validationResponse.diff === "") {
    logger.stdout(`Local changes: ${chalk.bold("none")}\n`);
  } else {
    logger.stdout(`Local changes:\n`);
    logger.stdout(`  ${validationResponse.diff.split("\n").join("\n  ")}`);
    logger.stdout("(use `fauna schema diff` to display local changes)");
    logger.stdout("(use `fauna schema push` to stage local changes)");
  }
}

function buildStatusCommand(yargs) {
  return yargsWithCommonQueryOptions(yargs)
    .example([
      [
        "$0 schema status --database us/example",
        "Get the staged schema status for the 'us/example' database."
      ],
      [
        "$0 schema status --secret my-secret",
        "Get the staged schema status for the database scoped to a secret."
      ],
    ])
    .help("help", "Show help.");
}

export default {
  command: "status",
  description: "Show a database's staged schema status.",
  builder: buildStatusCommand,
  handler: doStatus,
};
