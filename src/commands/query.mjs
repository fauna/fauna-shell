//@ts-check

import { container } from "../cli.mjs";
import {
  resolveFormat,
  validateDatabaseOrSecret,
  yargsWithCommonConfigurableQueryOptions,
} from "../lib/command-helpers.mjs";
import {
  CommandError,
  isUnknownError,
  ValidationError,
} from "../lib/errors.mjs";
import {
  formatError,
  formatQueryResponse,
  getSecret,
} from "../lib/fauna-client.mjs";
import { isTTY } from "../lib/misc.mjs";

function validate(argv) {
  const { existsSync, accessSync, constants } = container.resolve("fs");
  const dirname = container.resolve("dirname");

  // don't validate completion invocations
  if (argv.getYargsCompletions) return;

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
  const formatQueryInfo = container.resolve("formatQueryInfo");
  const logger = container.resolve("logger");

  // Run validation here instead of via check for more control over output
  validateDatabaseOrSecret(argv);
  validate(argv);

  // resolve the input
  const expression = resolveInput(argv);

  // get the query handler and run the query
  try {
    const secret = await getSecret();
    const {
      url,
      timeout,
      typecheck,
      apiVersion,
      performanceHints,
      color,
      include,
    } = argv;

    // If we're writing to a file, don't colorize the output regardless of the user's preference
    const useColor = argv.output || !isTTY() ? false : color;

    // Using --json takes precedence over --format
    const outputFormat = resolveFormat(argv);

    const results = await container.resolve("runQueryFromString")(expression, {
      apiVersion,
      secret,
      url,
      timeout,
      typecheck,
      performanceHints,
      format: outputFormat,
      color: useColor,
    });

    // If any query info should be displayed, print to stderr.
    // This is only supported in v10.
    if (include.length > 0 && apiVersion === "10") {
      const queryInfo = formatQueryInfo(results, {
        apiVersion,
        color: useColor,
        include,
      });
      if (queryInfo) {
        logger.stderr(queryInfo);
      }
    }

    const output = formatQueryResponse(results, {
      apiVersion,
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

    const { apiVersion, color } = argv;
    throw new CommandError(formatError(err, { apiVersion, color }), {
      cause: err,
    });
  }
}

function buildQueryCommand(yargs) {
  return yargsWithCommonConfigurableQueryOptions(yargs)
    .positional("fql", {
      type: "string",
      description: "FQL query to run. Use - to read from stdin.",
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
    })
    .example([
      [
        '$0 query "Collection.all()" --database us/my_db',
        "Run the query in the 'us/my_db' database and write the results to stdout.",
      ],
      [
        '$0 query "Collection.all()" --database us/my_db --role server',
        "Run the query in the 'us/my_db' database using the 'server' role.",
      ],
      [
        '$0 query "Collection.all()" --secret my-secret',
        "Run the query in the database scoped to a secret.",
      ],
      [
        "$0 query -i /path/to/query.fql --database us/my_db",
        "Run the query from a file.",
      ],
      [
        'echo "1 + 1" | $0 query - --database us/my_db',
        "Run the query from stdin.",
      ],
      [
        "$0 query -i /path/to/query.fql --output /tmp/result.json --database us/my_db",
        "Run the query and write the results to a file.",
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
