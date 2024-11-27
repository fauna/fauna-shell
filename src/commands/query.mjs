//@ts-check

import { container } from "../cli.mjs";
import {
  commonConfigurableQueryOptions,
} from "../lib/command-helpers.mjs";
import { formatError, formatQueryResponse, getSecret } from "../lib/fauna-client.mjs";

function validate(argv) {
  const { existsSync, accessSync, constants } = container.resolve("fs");
  const dirname = container.resolve("dirname");

  if (argv.input && argv.fql) {
    throw new Error("Cannot specify both --input and [fql]");
  }

  if (!argv.input && !argv.fql) {
    throw new Error("No query specified. Pass [fql] or --input.");
  }

  if (argv.input && !existsSync(argv.input)) {
    throw new Error(`File passed to --input does not exist: ${argv.input}`);
  }

  if (argv.output) {
    const outputDir = dirname(argv.output);
    try {
      accessSync(outputDir, constants.W_OK);
    } catch (e) {
      throw new Error(`Unable to write to output directory: ${outputDir}`);
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
}

async function query(argv) {
  if (!argv.database && !argv.secret) {
    throw new Error("No database or secret specified. Pass --database or --secret.");
  }

  // validate the arguments and throw if they are invalid
  validate(argv);

  // resolve the input
  const expression = resolveInput(argv);

  // get the query handler and run the query
  try {
    const secret = await getSecret();
    const { url, timeout, typecheck, extra, json, apiVersion } = argv
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
    });

    if (argv.output) {
      container.resolve("fs").writeFileSync(argv.output, output);
    } else {
      container.resolve("logger").stdout(output);
    }

    return results;
  } catch (err) {
    err.message = formatError(err, { apiVersion: argv.apiVersion, extra: argv.extra }); 
    throw err;
  }
}

function buildQueryCommand(yargs) {
  return yargs
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
      ...commonConfigurableQueryOptions,
    })
    .example([
      ['$0 query "Collection.all()"', "run the query and write to stdout "],
      ["$0 query -i /path/to/queries.fql", "run the query from a file"],
      ['echo "1 + 1" | $0 query -', "run the query from stdin"],
      ['$0 query -i /path/to/queries.fql -o /tmp/result.json', "run the query and write to a file"],
      ['$0 query -i /path/to/queries.fql -o /tmp/result.json --extra', "run the query and write full API response to a file"],
    ])
    .version(false)
    .help("help", "show help");
}

export default {
  command: "query [fql]",
  aliases: ["eval"],
  describe: "execute a query",
  builder: buildQueryCommand,
  handler: query,
};
