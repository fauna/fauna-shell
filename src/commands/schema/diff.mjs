//@ts-check

import chalk from "chalk";

import { container } from "../../cli.mjs";
import { commonQueryOptions } from "../../lib/command-helpers.mjs";
import { reformatFSL } from "../../lib/schema.mjs";

/**
 * @returns string[]
 */
function parseTarget(argv) {
  if (!argv.active && !argv.staged) {
    return ["staged", "local"];
  }

  if (argv.active && argv.staged) {
    throw new Error("Cannot specify both --active and --staged");
  }

  if (argv.active) {
    return ["active", "local"];
  } else if (argv.staged) {
    return ["active", "staged"];
  } else {
    throw new Error("Invalid target. Expected: active or staged");
  }
}

async function doDiff(argv) {
  const [source, target] = parseTarget(argv);
  const diffKind = argv.text ? "textual" : "semantic";

  const gatherFSL = container.resolve("gatherFSL");
  const logger = container.resolve("logger");
  const makeFaunaRequest = container.resolve("makeFaunaRequest");

  const files = reformatFSL(await gatherFSL(argv.dir));

  const params = new URLSearchParams({});
  if (argv.color) params.set("color", "ansi");
  if (target === "staged") params.set("diff", diffKind);

  const { version, status, diff } = await makeFaunaRequest({
    argv,
    path: "/schema/1/staged/status",
    params,
    method: "GET",
  });

  if (target === "staged") {
    logger.stdout(
      `Differences from the ${chalk.bold("remote, active")} schema to the ${chalk.bold("remote, staged")} schema:`,
    );
    if (status === "none") {
      logger.stdout("There is no staged schema present.");
    } else {
      logger.stdout(diff ? diff : "No schema differences.");
    }
  } else {
    const params = new URLSearchParams({
      diff: diffKind,
      staged: String(source === "staged"),
    });
    if (argv.color) params.set("color", "ansi");
    if (version) {
      params.set("version", version);
    } else {
      params.set("force", "true");
    }

    const { diff } = await makeFaunaRequest({
      argv,
      path: "/schema/1/validate",
      params,
      body: files,
      method: "POST",
    });

    if (status === "none") {
      logger.stdout(
        `Differences from the ${chalk.bold("remote")} schema to the ${chalk.bold("local")} schema:`,
      );
    } else if (source === "active") {
      logger.stdout(
        `Differences from the ${chalk.bold("remote, active")} schema to the ${chalk.bold("local")} schema:`,
      );
    } else {
      logger.stdout(
        `Differences from the ${chalk.bold("remote, staged")} schema to the ${chalk.bold("local")} schema:`,
      );
    }
    logger.stdout(diff ? diff : "No schema differences.");
  }
}

function buildDiffCommand(yargs) {
  return yargs
    .options({
      staged: {
        description:
          "Show the diff between the active and staged schema, instead of the local schema.",
        default: false,
        type: "boolean",
      },
      text: {
        description: "Display the text diff instead of the semantic diff.",
        default: false,
        type: "boolean",
      },
      active: {
        description:
          "Show the diff against the active schema instead of the staged schema.",
        default: false,
        type: "boolean",
      },
      ...commonQueryOptions,
    })
    .example([
      ["$0 schema diff"],
      ["$0 schema diff --dir schemas/myschema"],
      ["$0 schema diff --staged"],
      ["$0 schema diff --active --text"],
    ])
    .version(false)
    .help("help", "show help");
}

export default {
  command: "diff",
  description: "Print the diff between local and remote schema.",
  builder: buildDiffCommand,
  handler: doDiff,
};
