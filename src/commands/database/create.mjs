//@ts-check

import { container } from "../../cli.mjs";
import { commonQueryOptions } from "../../lib/command-helpers.mjs";
import { performQuery } from "../eval.mjs";

async function createDatabase(argv) {
  const client = await container.resolve("getSimpleClient")(argv);
  const credentials = await container.resolve("credentials");
  const logger = container.resolve("logger");
  logger.info("credentials", credentials);
  const result = await performQuery(client, "1 + 1", undefined, {
    ...argv,
    format: "json-tagged",
  });
  const result2 = await performQuery(client, "2 + 2", undefined, {
    ...argv,
    format: "json-tagged",
  });
  logger.stdout(result, result2);
}

function buildCreateCommand(yargs) {
  return (
    yargs
      .options({
        name: {
          type: "string",
          description: "the name of the database to create",
        },
        ...commonQueryOptions,
        secret: {
          type: "string",
          description: "the secret",
        },
      })
      // .demandOption("name")
      .version(false)
      .help("help", "show help")
  );
}

export default {
  command: "create",
  description: "Creates a database",
  builder: buildCreateCommand,
  handler: createDatabase,
};
