//@ts-check

import { yargsWithCommonQueryOptions } from "../../lib/command-helpers.mjs";
import { pushSchema } from "../../lib/schema.mjs";
import { localSchemaOptions } from "./schema.mjs";

function buildPushCommand(yargs) {
  return yargsWithCommonQueryOptions(yargs)
    .options({
      input: {
        description:
          "Prompt for input, such as confirmation. To disable prompts, use `--no-input` or `--input=false`. Disabled prompts are useful for scripts, CI/CD, and automation workflows.",
        default: true,
        type: "boolean",
      },
      active: {
        description:
          "Immediately apply the local schema to the database's active schema. Skips staging the schema. Can result in temporarily unavailable indexes.",
        type: "boolean",
        default: false,
      },
      ...localSchemaOptions,
    })
    .example([
      [
        "$0 schema push --database us/example --dir /path/to/schema",
        "Stage schema changes for the 'us/example' database. If schema is already staged, replace the staged schema.",
      ],
      [
        "$0 schema push --secret my-secret --dir /path/to/schema",
        "Stage schema changes for the database scoped to a secret. If schema is already staged, replace the staged schema.",
      ],
      [
        "$0 schema push --database us/example --dir /path/to/schema --active",
        "Immediately apply changes to the 'us/example' database's active schema.",
      ],
      [
        "$0 schema push --database us/example --dir /path/to/schema --no-input",
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
