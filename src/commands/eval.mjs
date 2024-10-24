//@ts-check

const EVAL_OUTPUT_FORMATS = ["json", "json-tagged", "shell"];

import { existsSync } from "fs";
import util from "util";

import { container } from "../cli.mjs";
import {
  // ensureDbScopeClient,
  commonQueryOptions,
} from "../lib/command-helpers.mjs";
import * as misc from "../lib/misc.mjs";

const { runQuery } = misc;

/**
 * Write json encoded output
 *
 * @param {String} file Target filename
 * @param {any}    data Data to encode
 */
async function writeFormattedJson(file, data) {
  let str = JSON.stringify(data);
  if (file === null) {
    return str;
  } else {
    // await writeFile(file, str);
    return undefined;
  }
}

/**
 * Write fauna shell encoded output
 *
 * @param {String} file Target filename
 * @param {any}    str Data to encode
 */
async function writeFormattedShell(file, str) {
  if (file === null) {
    return str;
  } else {
    // await writeFile(file, str);
    return undefined;
  }
}

/**
 * Writes out the formatted output to file
 *
 * @param {*} file Target filename
 * @param {*} data Data to write
 * @param {*} format Format to write as
 */
async function writeFormattedOutput(file, data, format) {
  if (format === "json") {
    return writeFormattedJson(file, data);
  } else if (format === "shell") {
    return writeFormattedShell(file, util.inspect(data, { depth: null }));
  } else {
    throw new Error(`Unrecognized format ${format}.`);
  }
}

async function writeFormattedOutputV10(file, res, format) {
  const isOk = res.status >= 200 && res.status <= 299;

  if (format === "json" || format === "json-tagged") {
    if (isOk) {
      return writeFormattedJson(file, res.body.data);
    } else {
      return writeFormattedJson(file, {
        error: res.body.error,
        summary: res.body.summary,
      });
    }
  } else if (format === "shell") {
    let output = "";
    if (isOk) {
      output += res.body.summary ?? "";
      if (output) {
        output += "\n\n";
      }
      output += res.body.data ?? "";
    } else {
      output = `${res.body.error?.code ?? ""}: ${res.body.error?.message ?? ""}`;
      if (res.body.summary) {
        output += "\n\n";
        output += res.body.summary ?? "";
      }
    }
    return writeFormattedShell(file, output);
  } else {
    throw new Error("Unsupported output format");
  }
}

async function performV10Query(client, fqlQuery, outputFile, flags) {
  let format;
  if (flags.format === "shell") {
    format = "decorated";
  } else if (flags.format === "json-tagged") {
    format = "tagged";
  } else {
    format = "simple";
  }

  const res = await client.query(fqlQuery, {
    format,
    typecheck: flags.typecheck,
  });

  return writeFormattedOutputV10(outputFile, res, flags.format);
}

async function performV4Query(client, fqlQuery, outputFile, flags) {
  const faunadb = (await import("faunadb")).default;

  // why...?
  if (flags.format === "json-tagged") {
    flags.format = "json";
  }

  try {
    const response = await runQuery(fqlQuery, client);
    return await writeFormattedOutput(outputFile, response, flags.format);
  } catch (error) {
    if (error.faunaError === undefined) {
      // this happens when wrapQueries fails during the runInContext step
      // at that point, we have Errors that didn't get run as a query, so
      // they don't have a .faunaError property. regardless, the error
      // message at this point is correct - we don't want to change it any.
    } else if (error.faunaError instanceof faunadb.errors.FaunaHTTPError) {
      error.message = util.inspect(
        JSON.parse(error.faunaError.requestResult.responseRaw),
        {
          depth: null,
          compact: false,
        },
      );
    } else {
      error.message = error.faunaError.message;
    }

    throw error;
  }
}

/**
 * Perform a v4 or v10 query, depending on the FQL version
 *
 * @param {Object} client - An instance of the client used to execute the query.
 * @param {string} fqlQuery - The FQL v4 query to be executed.
 * @param {string} outputFile - Target filename
 * @param {Object} flags - Options for the query execution.
 * @param {("4" | "10")} flags.version - FQL version number
 * @param {("json" | "json-tagged" | "shell")} flags.format - Result format
 * @param {boolean} [flags.typecheck] - (Optional) Flag to enable typechecking
 */
export async function performQuery(client, fqlQuery, outputFile, flags) {
  if (flags.version === "4") {
    const res = performV4Query(client, fqlQuery, outputFile, flags);
    return res;
  } else {
    return performV10Query(client, fqlQuery, outputFile, flags);
  }
}

async function doEval(argv) {
  const noSourceSet =
    !argv.stdin && argv.query === undefined && argv.file === undefined;
  if (noSourceSet) {
    throw new Error(
      "No source set. Pass --stdin to  read from stdin or --file.",
    );
  }

  // const client = argv.dbname
  //   ? (
  //       await ensureDbScopeClient({
  //         scope: argv.dbname,
  //         version: argv.version,
  //         argv,
  //       })
  //     ).client
  //   : container.resolve("getSimpleClient")(argv);

  // used to use ensureDbScopeClient
  if (argv.dbname) throw new Error("Not currently supported!");

  // used to use runQueries/wrapQueries
  if (argv.stdin) throw new Error("Not currently supported!");

  // used to use runQueries/wrapQueries
  if (argv.file) throw new Error("Not currently supported!");

  const client = await container.resolve("getSimpleClient")(argv);

  const readQuery = argv.stdin || argv.file !== undefined;
  let queryFromFile;
  if (readQuery) {
    if (argv.stdin && !existsSync(argv.file)) {
      container.resolve("logger").warn("Reading from stdin");
      argv.file = process.stdin.fd;
    }
    // queryFromFile = await readFile(argv.file);
  }

  const format = argv.format ?? (process.stdout.isTTY ? "shell" : "json");

  const performQuery = container.resolve("performQuery");

  const result = await performQuery(
    client,
    queryFromFile || argv.query,
    argv.output,
    {
      format: format,
      version: argv.version,
      typecheck: argv.typecheck,
    },
  );

  if (result) {
    container.resolve("logger").stdout(result);
  }

  // required to make the process not hang
  client.close();

  return result;
}

function buildEvalCommand(yargs) {
  return yargs
    .options({
      file: {
        type: "string",
        description: "file path to read the query (or queries) from",
      },
      query: {
        type: "string",
        description: "the query to run",
      },
      dbname: {
        type: "string",
        description: "the database to run the query against",
      },
      stdin: {
        type: "boolean",
        description: "read file input from stdin. Writes to stdout by default",
        default: false,
      },
      output: {
        type: "string",
        description: "file to write output to",
        default: null,
      },
      format: {
        type: "string",
        description: "output format",
        default: "shell",
        options: EVAL_OUTPUT_FORMATS,
      },
      version: {
        description: "which FQL version to use",
        type: "string",
        alias: "v",
        default: "10",
        choices: ["4", "10"],
      },
      // TODO: is this unused? i think it might be
      timeout: {
        type: "number",
        description: "connection timeout in milliseconds",
        default: 5000,
      },

      // v10 specific options
      typecheck: {
        type: "boolean",
        description: "enable typechecking",
        default: undefined,
      },
      ...commonQueryOptions,
    })
    .example([
      ['$0 eval "Collection.all()"'],
      ['$0 eval nestedDbName "Collection.all()"'],
      ["$0 eval --file=/path/to/queries.fql"],
      ['echo "1 + 1" | $0 eval'],
      ['$0 eval "2 + 3" --output=/tmp/result"'],
      ['$0 eval "2 + 3" --format=json --output=/tmp/result"'],
    ])
    .version(false)
    .help("help", "show help");
}

export default {
  builder: buildEvalCommand,
  handler: doEval,
};
