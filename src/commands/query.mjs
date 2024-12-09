//@ts-check

import { container } from "../cli.mjs";
import {
  CommandError,
  isUnknownError,
  resolveFormat,
  validateDatabaseOrSecret,
  ValidationError,
  yargsWithCommonConfigurableQueryOptions,
} from "../lib/command-helpers.mjs";
import {
  formatError,
  formatQueryResponse,
  getSecret,
} from "../lib/fauna-client.mjs";
import { isTTY } from "../lib/misc.mjs";

function validate(argv) {
  const { existsSync, accessSync, constants } = container.resolve("fs");
  const dirname = container.resolve("dirname");

  if (argv.input && argv.fql) {
    throw new ValidationError("Cannot specify both --input and [fql]");
  }

  if (!argv.input && !argv.fql) {
    throw new ValidationError("No query specified. Pass [fql] or --input.");
  }

  if (argv.input && !existsSync(argv.input)) {
    throw new ValidationError(
      `File passed to --input does not exist: ${argv.input}`,
    );
  }

  if (argv.output) {
    const outputDir = dirname(argv.output);
    try {
      accessSync(outputDir, constants.W_OK);
    } catch (e) {
      throw new ValidationError(
        `Unable to write to output directory: ${outputDir}`,
      );
    }
  }
}

const resolveInput = (argv) => {
  const { readFileSync } = container.resolve("fs");
  const logger = container.resolve("logger");

  if (argv.input) {
    logger.debug(`reading query from ${argv.input}`, "argv");
    return readFileSync(argv.input, "utf8");
  }

  if (argv.fql === "-") {
    logger.debug("reading query from stdin", "argv");
    return readFileSync(process.stdin.fd, "utf8");
  }

  logger.debug("no --input specified, using [fql]", "argv");
  return argv.fql;
};

async function queryCommand(argv) {
  // Run validation here instead of via check for more control over output
  validateDatabaseOrSecret(argv);
  validate(argv);

  // resolve the input
  const expression = resolveInput(argv);

  // get the query handler and run the query
  try {
    const secret = await getSecret();
    const { url, timeout, typecheck, apiVersion, color, extra } = argv;

    // If we're writing to a file, don't colorize the output regardless of the user's preference
    const useColor = argv.output || !isTTY() ? false : color;

    // Using --json or --extra takes precedence over --format
    const outputFormat = resolveFormat(argv);

    const results = await container.resolve("runQueryFromString")(expression, {
      apiVersion,
      secret,
      url,
      timeout,
      typecheck,
      format: outputFormat,
      extra,
      color: useColor,
    });

    const output = await formatQueryResponse(results, {
      apiVersion,
      extra,
      format: outputFormat,
      color: useColor,
    });

    if (argv.output) {
      container.resolve("fs").writeFileSync(argv.output, output);
    } else {
      container.resolve("logger").stdout(output);
    }

    return results;
  } catch (err) {
    if (!isUnknownError(err)) {
      throw err;
    }

    const { apiVersion, extra, color } = argv;
    throw new CommandError(
      await formatError(err, { apiVersion, extra, color }),
      {
        cause: err,
      },
    );
  }
}

function buildQueryCommand(yargs) {
  return yargsWithCommonConfigurableQueryOptions(yargs)
    .positional("fql", {
      type: "string",
      description: "FQL query to run. Use `-` to read from stdin.",
    })
    .nargs("fql", 1)
    .options({
      input: {
        alias: "i",
        type: "string",
        description: "Path to a file containing an FQL query to run.",
      },
      output: {
        alias: "o",
        type: "string",
        description:
          "Path to a file where query results are written. Defaults to stdout.",
      },
      extra: {
        type: "boolean",
        description:
          "Output the full API response, including summary and query stats.",
        default: false,
      },
    })
    .example([
      [
        '$0 query "Collection.all()" --database us/example',
        "Run the query in the 'us/example' database and write the results to stdout.",
      ],
      [
        '$0 query "Collection.all()" --database us/example --role server',
        "Run the query in the 'us/example' database using the 'server' role.",
      ],
      [
        '$0 query "Collection.all()" --secret my-secret',
        "Run the query in the database scoped to a secret.",
      ],
      [
        "$0 query -i /path/to/query.fql --database us/example",
        "Run the query from a file.",
      ],
      [
        'echo "1 + 1" | $0 query - --database us/example',
        "Run the query from stdin.",
      ],
      [
        "$0 query -i /path/to/queries.fql --output /tmp/result.json --database us/example",
        "Run the query and write the results to a file.",
      ],
      [
        "$0 query -i /path/to/queries.fql --extra --output /tmp/result.json --database us/example",
        "Run the query and write the full API response to a file.",
      ],
    ]);
}

export default {
  command: "query [fql]",
  aliases: ["eval"],
  describe: "Run an FQL query.",
  builder: buildQueryCommand,
  handler: queryCommand,
};
