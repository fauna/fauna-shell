//@ts-check

import chalk from "chalk";

import { container } from "../../cli.mjs";
import { commonQueryOptions } from "../../lib/command-helpers.mjs";
import { reformatFSL } from "../../lib/schema.mjs";

async function doDiff(argv) {
  const gatherFSL = container.resolve("gatherFSL");
  const logger = container.resolve("logger");
  const makeFaunaRequest = container.resolve("makeFaunaRequest");

  const files = reformatFSL(await gatherFSL(argv.dir));

  const params = new URLSearchParams({ force: "true" });
  if (argv.color) params.set("color", "ansi");
  params.set("staged", argv.staged);

  const response = await makeFaunaRequest({
    baseUrl: argv.url,
    path: new URL(`/schema/1/validate?${params}`, argv.url).href,
    secret: argv.secret,
    body: files,
    method: "POST",
  });

  const bold = argv.color ? chalk.bold : (str) => str;
  const description = argv.staged ? "remote, staged" : "remote, active";
  logger.stdout(
    `Differences between the ${bold("local")} schema and the ${bold(
      description,
    )} schema:`,
  );
  logger.stdout(response.diff ? response.diff : "No schema differences");
}

function buildDiffCommand(yargs) {
  return yargs
    .options({
      staged: {
        description:
          "Compare the local schema to the staged schema instead of the active schema.",
        default: false,
        type: "boolean",
      },
      ...commonQueryOptions,
    })
    .example([["$0 schema diff"], ["$0 schema diff --dir schemas/myschema"]])
    .version(false)
    .help("help", "show help");
}

export default {
  command: "diff",
  description: "Print the diff between local and remote schema.",
  builder: buildDiffCommand,
  handler: doDiff,
};
