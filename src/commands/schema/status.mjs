//@ts-check

import chalk from "chalk";

import { container } from "../../cli.mjs";
import { yargsWithCommonQueryOptions } from "../../lib/command-helpers.mjs";
import { reformatFSL } from "../../lib/schema.mjs";

async function doStatus(argv) {
  const logger = container.resolve("logger");
  const makeFaunaRequest = container.resolve("makeFaunaRequest");

  let params = new URLSearchParams({ diff: "summary" });
  const gatherFSL = container.resolve("gatherFSL");
  const fsl = reformatFSL(await gatherFSL(argv.dir));

  const statusResponse = await makeFaunaRequest({
    argv,
    path: "/schema/1/staged/status",
    params,
    method: "GET",
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
    throw new Error(validationResponse.error.message);
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
    .example([["$0 schema status"]])
    .version(false)
    .help("help", "show help");
}

export default {
  command: "status",
  description: "Print the staged schema status.",
  builder: buildStatusCommand,
  handler: doStatus,
};
