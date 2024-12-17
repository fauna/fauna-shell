//@ts-check

import chalk from "chalk";
import path from "path";

import { container } from "../../cli.mjs";
import { yargsWithCommonQueryOptions } from "../../lib/command-helpers.mjs";
import { CommandError } from "../../lib/errors.mjs";
import { reformatFSL } from "../../lib/schema.mjs";
import { localSchemaOptions } from "./schema.mjs";

async function doStatus(argv) {
  const { getSecret } = container.resolve("faunaClient");
  const gatherFSL = container.resolve("gatherFSL");
  const logger = container.resolve("logger");
  const makeFaunaRequest = container.resolve("makeFaunaRequest");

  const secret = await getSecret();
  const absoluteDirPath = path.resolve(argv.dir);
  const fslFiles = await gatherFSL(argv.dir);
  const hasLocalSchema = fslFiles.length > 0;
  const fsl = reformatFSL(fslFiles);

  const statusParams = new URLSearchParams({ format: "summary" });
  const statusResponse = await makeFaunaRequest({
    argv,
    path: "/schema/1/staged/status",
    params: statusParams,
    method: "GET",
    secret,
  });

  let diffResponse = null;
  if (hasLocalSchema) {
    const diffParams = new URLSearchParams({
      staged: "true",
      format: "summary",
      version: statusResponse.version,
    });
    diffResponse = await makeFaunaRequest({
      argv,
      path: "/schema/1/diff",
      params: diffParams,
      method: "POST",
      body: fsl,
      secret,
    });
  }

  // Output the status response
  logger.stdout(`Staged changes: ${chalk.bold(statusResponse.status)}`);
  if (statusResponse.pending_summary !== "") {
    logger.stdout(statusResponse.pending_summary);
  }
  if (statusResponse.diff) {
    logger.stdout("Staged changes:\n");
    logger.stdout(statusResponse.diff.split("\n").join("\n  "));
  }

  // Output the diff response
  if (!hasLocalSchema) {
    logger.stdout(
      `Local changes: ${chalk.bold(`no schema files found in '${absoluteDirPath}'`)}\n`,
    );
    return;
  }

  if (diffResponse.error) {
    throw new CommandError(diffResponse.error.message);
  }

  if (diffResponse.diff === "") {
    logger.stdout(`Local changes: ${chalk.bold("none")}\n`);
    return;
  }

  logger.stdout(`Local changes:\n`);
  logger.stdout(`  ${diffResponse.diff.split("\n").join("\n  ")}`);
  logger.stdout("(use `fauna schema diff` to display local changes)");
  logger.stdout("(use `fauna schema push` to stage local changes)");
}

function buildStatusCommand(yargs) {
  return yargsWithCommonQueryOptions(yargs)
    .options(localSchemaOptions)
    .example([
      [
        "$0 schema status --database us/example",
        "Get the staged schema status for the 'us/example' database.",
      ],
      [
        "$0 schema status --secret my-secret",
        "Get the staged schema status for the database scoped to a secret.",
      ],
    ]);
}

export default {
  command: "status",
  description: "Show a database's staged schema status.",
  builder: buildStatusCommand,
  handler: doStatus,
};
