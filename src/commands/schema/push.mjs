//@ts-check

import path from "path";

import { container } from "../../config/container.mjs";
import { ValidationError } from "../../lib/errors.mjs";
import { getSecret } from "../../lib/fauna-client.mjs";
import { reformatFSL } from "../../lib/schema.mjs";
import { LOCAL_SCHEMA_OPTIONS } from "./schema.mjs";

/**
 * Pushes a schema (FSL) based on argv.
 * @param {import("yargs").Argv & {dir: string, active: boolean, input: boolean}} argv
 */
export async function pushSchema(argv) {
  const logger = container.resolve("logger");
  const makeFaunaRequest = container.resolve("makeFaunaRequest");
  const gatherFSL = container.resolve("gatherFSL");

  const isStagedPush = !argv.active;
  const secret = await getSecret(argv);
  const fslFiles = await gatherFSL(argv.dir);
  const hasLocalSchema = fslFiles.length > 0;
  const absoluteDirPath = path.resolve(argv.dir);
  const fsl = reformatFSL(fslFiles);

  if (!hasLocalSchema) {
    throw new ValidationError(
      `No schema files (*.fsl) found in '${absoluteDirPath}'. Use '--dir' to specify a different directory, or create new .fsl files in this location.`,
    );
  } else if (!argv.input) {
    const params = new URLSearchParams({
      staged: argv.active ? "false" : "true",
    });

    await makeFaunaRequest({
      argv,
      path: "/schema/1/update",
      params,
      body: fsl,
      method: "POST",
      secret,
    });
  } else {
    // Confirm diff, then push it.
    const params = new URLSearchParams({
      staged: argv.active ? "false" : "true",
    });

    const response = await makeFaunaRequest({
      argv,
      path: "/schema/1/diff",
      params,
      body: fsl,
      method: "POST",
      secret,
    });

    let message = isStagedPush
      ? "Stage the above changes?"
      : "Push the above changes?";
    if (response.diff) {
      logger.stdout(`Proposed diff:\n`);
      logger.stdout(response.diff);
    } else {
      logger.stdout("No logical changes.");
      message = isStagedPush
        ? "Stage the file contents anyway?"
        : "Push the file contents anyway?";
    }

    const confirm = container.resolve("confirm");
    const confirmed = await confirm({
      message,
      default: false,
    });

    if (confirmed) {
      const params = new URLSearchParams({
        version: response.version,
        staged: argv.active ? "false" : "true",
      });

      await makeFaunaRequest({
        argv,
        path: "/schema/1/update",
        params,
        body: fsl,
        method: "POST",
        secret,
      });
    } else {
      logger.stdout("Push cancelled.");
    }
  }
}

function buildPushCommand(yargs) {
  return yargs
    .options(LOCAL_SCHEMA_OPTIONS)
    .options({
      input: {
        description: "Prompt for input. Use --no-input to disable.",
        default: true,
        type: "boolean",
      },
      active: {
        description:
          "Apply the local schema to the database's active schema. Can result in temporarily unavailable indexes.",
        type: "boolean",
        default: false,
      },
    })
    .example([
      [
        "$0 schema push --database us/my_db --dir /path/to/schema/dir",
        "Stage schema changes for the 'us/my_db' database. If schema is already staged, replace the staged schema.",
      ],
      [
        "$0 schema push --secret my-secret --dir /path/to/schema/dir",
        "Stage schema changes for the database scoped to a secret. If schema is already staged, replace the staged schema.",
      ],
      [
        "$0 schema push --database us/my_db --dir /path/to/schema/dir --active",
        "Immediately apply changes to the 'us/my_db' database's active schema.",
      ],
      [
        "$0 schema push --database us/my_db --dir /path/to/schema/dir --no-input",
        "Run the command without input prompts.",
      ],
    ]);
}

export default {
  command: "push",
  description: "Push local .fsl schema files to Fauna.",
  builder: buildPushCommand,
  handler: pushSchema,
};
