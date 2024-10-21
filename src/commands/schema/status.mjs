//@ts-check

import chalk from "chalk";

import { container } from "../../cli.mjs";
import { commonQueryOptions } from "../../lib/command-helpers.mjs";
import { reformatFSL } from "../../lib/schema.mjs";

async function doStatus(argv) {
  const logger = container.resolve("logger");
  const makeFaunaRequest = container.resolve("makeFaunaRequest");

  let params = new URLSearchParams({ diff: "summary" });
  if (argv.color) params.set("color", "ansi");
  const gatherFSL = container.resolve("gatherFSL");
  const fsl = reformatFSL(await gatherFSL(argv.dir));

  const statusResponse = await makeFaunaRequest({
    baseUrl: argv.url,
    path: "/schema/1/staged/status",
    params,
    secret: argv.secret,
    method: "GET",
  });

  params = new URLSearchParams({
    diff: "summary",
    staged: "true",
    version: statusResponse.version,
  });
  const validationResponse = await makeFaunaRequest({
    baseUrl: argv.url,
    path: "/schema/1/validate",
    params,
    secret: argv.secret,
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
  return yargs
    .options({
      ...commonQueryOptions,
    })
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
