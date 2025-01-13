//@ts-check

import chalk from "chalk";

import { container } from "../../config/container.mjs";
import { ValidationError } from "../../lib/errors.mjs";
import { getSecret } from "../../lib/fauna-client.mjs";
import { reformatFSL } from "../../lib/schema.mjs";
import { LOCAL_SCHEMA_OPTIONS } from "./schema.mjs";

/**
 * @returns {[string, string]} An tuple containing the source and target schema
 */
function parseTarget(argv) {
  if (!argv.active && !argv.staged) {
    return ["staged", "local"];
  }

  if (argv.active && argv.staged) {
    throw new ValidationError("Cannot specify both --active and --staged.");
  }

  if (argv.active) {
    return ["active", "local"];
  } else if (argv.staged) {
    return ["active", "staged"];
  } else {
    throw new ValidationError("Invalid target. Expected: active or staged.");
  }
}

function buildStatusParams(argv) {
  const params = new URLSearchParams({});
  const [, target] = parseTarget(argv);
  const diffKind = argv.text ? "textual" : "semantic";

  if (target === "staged") params.set("diff", diffKind);

  return params;
}

function buildValidateParams(argv, version) {
  const [source] = parseTarget(argv);
  const diffKind = argv.text ? "textual" : "semantic";
  const params = new URLSearchParams({
    diff: diffKind,
    staged: String(source === "staged"),
  });
  if (version) {
    params.set("version", version);
  } else {
    params.set("force", "true");
  }

  return params;
}

async function doDiff(argv) {
  const [source, target] = parseTarget(argv);

  const gatherFSL = container.resolve("gatherFSL");
  const logger = container.resolve("logger");
  const makeFaunaRequest = container.resolve("makeFaunaRequest");
  const secret = argv.secret ?? (await getSecret());
  const files = reformatFSL(await gatherFSL(argv.dir));

  const { version, status, diff } = await makeFaunaRequest({
    argv,
    path: "/schema/1/staged/status",
    params: buildStatusParams(argv),
    method: "GET",
    secret,
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
    const { diff } = await makeFaunaRequest({
      argv,
      path: "/schema/1/diff",
      params: buildValidateParams(argv, version),
      body: files,
      method: "POST",
      secret,
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
    .options(LOCAL_SCHEMA_OPTIONS)
    .options({
      staged: {
        description: "Show the diff between the active and staged schema.",
        default: false,
        type: "boolean",
      },
      text: {
        description:
          "Show a text diff. A text diff contains line-by-line changes, including comments and whitespace.",
        default: false,
        type: "boolean",
      },
      active: {
        description: "Show the diff between the active and local schema.",
        default: false,
        type: "boolean",
      },
    })
    .example([
      [
        "$0 schema diff --database us/my_db --dir /path/to/schema/dir",
        "Compare the 'us/my_db' database's staged schema to the local schema. If no schema is staged, compare the database's active schema to the local schema.",
      ],
      [
        "$0 schema diff --database us/my_db --dir /path/to/schema/dir --active",
        "Compare the 'us/my_db' database's active schema to the local schema.",
      ],
      [
        "$0 schema diff --secret my-secret --dir /path/to/schema/dir --active",
        "Compare the active schema of the database scoped to a secret to the local schema.",
      ],
      [
        "$0 schema diff --database us/my_db --dir /path/to/schema/dir --staged",
        "Compare the 'us/my_db' database's active schema to its staged schema.",
      ],
      [
        "$0 schema diff --database us/my_db --dir /path/to/schema/dir --text",
        "Show a text diff instead of a semantic diff.",
      ],
    ]);
}

export default {
  command: "diff",
  description:
    "Show the diff between a database's local, staged, or active schema.",
  builder: buildDiffCommand,
  handler: doDiff,
};
