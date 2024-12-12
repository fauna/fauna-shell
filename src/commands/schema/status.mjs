//@ts-check

import chalk from "chalk";
import path from "path";

import { container } from "../../cli.mjs";
import { yargsWithCommonQueryOptions } from "../../lib/command-helpers.mjs";
import { CommandError } from "../../lib/errors.mjs";
import { getSecret } from "../../lib/fauna-client.mjs";
import { reformatFSL } from "../../lib/schema.mjs";
import { localSchemaOptions } from "./schema.mjs";

const tab = "  ";

// Helper functions to reduce repetition
const logLineWithTab = (
  line,
  { numTabs = 1, logger = container.resolve("logger").stdout } = {},
) => logger(tab.repeat(numTabs) + line);

const formatDatabaseName = (database) => (database ? ` for '${database}'` : "");

const logDiff = (diff, numTabs = 3) => {
  for (const line of diff.trim().split("\n")) {
    logLineWithTab(line, { numTabs });
  }
};

async function doStatus(argv) {
  const logger = container.resolve("logger");
  const makeFaunaRequest = container.resolve("makeFaunaRequest");

  const secret = await getSecret();
  const absoluteDirPath = path.resolve(argv.dir);
  const gatherFSL = container.resolve("gatherFSL");
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
  switch (statusResponse.status) {
    case "none":
      logger.stdout(`No changes staged${formatDatabaseName(argv.database)}.`);
      break;
    case "pending":
    case "ready":
      logger.stdout(
        `Staged changes${formatDatabaseName(argv.database)} are ${chalk.bold(statusResponse.status)}:`,
      );
      if (statusResponse.status === "ready" && statusResponse.diff) {
        logLineWithTab("(use `fauna schema commit` to commit staged changes)");
        logDiff(statusResponse.diff);
      } else if (statusResponse.pending_summary) {
        logDiff(statusResponse.pending_summary, 1);
      }
      break;
    case "failed":
      logger.stdout(
        `Staged changes${formatDatabaseName(argv.database)} have ${chalk.bold(statusResponse.status)}.`,
      );
      break;
    default:
      logLineWithTab(`Staged changes: ${statusResponse.status}`);
  }

  // Handle local changes
  if (!hasLocalSchema) {
    logger.stdout(
      `\nNo local changes. No schema files found in '${absoluteDirPath}'.\n`,
    );
    return;
  }

  if (diffResponse.error) {
    throw new CommandError(diffResponse.error.message);
  }

  if (diffResponse.diff === "") {
    logger.stdout(
      `\nNo local changes${argv.dir !== "." ? ` in '${argv.dir}'` : ""}.\n`,
    );
    return;
  }

  const dirInfo = argv.dir !== "." ? ` in '${argv.dir}'` : "";
  logger.stdout(`\nLocal changes${dirInfo}:`);
  logLineWithTab("(use `fauna schema diff` to display local changes)");
  logLineWithTab("(use `fauna schema push` to stage local changes)");
  logDiff(diffResponse.diff);
  logger.stdout("");
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
