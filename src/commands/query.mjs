//@ts-check

import { container } from "../cli.mjs";
import {
  CommandError,
  isUnknownError,
  validateDatabaseOrSecret,
  ValidationError,
  yargsWithCommonConfigurableQueryOptions,
} from "../lib/command-helpers.mjs";
import {
  formatError,
  formatQueryResponse,
  getSecret,
} from "../lib/fauna-client.mjs";

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
    const { url, timeout, typecheck, extra, json, apiVersion, color } = argv;

    // If we're writing to a file, don't colorize the output regardless of the user's preference
    const useColor = argv.output ? false : color;

    const results = await container.resolve("runQueryFromString")(expression, {
      apiVersion,
      secret,
      url,
      timeout,
      typecheck,
    });

    const output = formatQueryResponse(results, {
      apiVersion,
      extra,
      json,
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
    throw new CommandError(formatError(err, { apiVersion, extra, color }), {
      cause: err,
    });
  }
}

function buildQueryCommand(yargs) {
  return yargsWithCommonConfigurableQueryOptions(yargs)
    .positional("fql", {
      type: "string",
      description: "the query to run; use - to read from stdin",
    })
    .nargs('fql', 1)
    .options({
      input: {
        alias: "i",
        type: "string",
        description:
          "file path to read the query (or queries) from",
      },
      output: {
        alias: "o",
        type: "string",
        description: "file path to write output to; defaults to stdout",
      },
      extra: {
        type: "boolean",
        description: "include additional information in the output, including stats",
        default: false,
      },
    })
    .example([
      ['$0 query "Collection.all()" --database us-std/example --role admin', "run the query and write to stdout "],
      ["$0 query -i /path/to/queries.fql --database us-std/example --role admin", "run the query from a file"],
      ['echo "1 + 1" | $0 query - --database us-std/example --role admin', "run the query from stdin"],
      ['$0 query -i /path/to/queries.fql -o /tmp/result.json --database us-std/example --role admin', "run the query and write to a file"],
      ['$0 query -i /path/to/queries.fql -o /tmp/result.json --extra --database us-std/example --role admin', "run the query and write full API response to a file"],
    ])
    .version(false)
    .help("help", "show help");
}

export default {
  command: "query [fql]",
  aliases: ["eval"],
  describe: "execute a query",
  builder: buildQueryCommand,
  handler: queryCommand,
};
