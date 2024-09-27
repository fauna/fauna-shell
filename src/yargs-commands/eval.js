const EVAL_OUTPUT_FORMATS = ["json", "json-tagged", "shell"];

import util from 'util'
import { existsSync } from 'fs'
import esprima from 'esprima'
import * as misc from '../lib/misc.js'
import { ensureDbScopeClient } from '../lib/command-helpers.js'
import { container } from '../cli.mjs'

const { readFile, runQueries, writeFile } = misc

/**
 * Write json encoded output
 *
 * @param {String} file Target filename
 * @param {Any}    data Data to encode
 */
async function writeFormattedJson(file, data) {
  let str = JSON.stringify(data);
  if (file === null) {
    return str;
  } else {
    await writeFile(file, str);
  }
}

/**
 * Write fauna shell encoded output
 *
 * @param {String} file Target filename
 * @param {Any}    data Data to encode
 */
async function writeFormattedShell(file, str) {
  if (file === null) {
    return str;
  } else {
    await writeFile(file, str);
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
  }
}

/**
  * Perform a v4 or v10 query, depending on the FQL version
  *
  * @param {Object} client - An instance of the client used to execute the query.
  * @param {string} fqlQuery - The FQL v4 query to be executed.
  * @param {string} outputFile - Target filename
  * @param {Object} flags - Options for the query execution.
  * @param {(4 | 10)} flags.version - FQL version number
  * @param {("json" | "json-tagged" | "shell")} flags.format - Result format
  * @param {boolean} [flags.typecheck] - (Optional) Flag to enable typechecking
  */
export async function performQuery(client, fqlQuery, outputFile, flags) {
  if (flags.version === '4') {
    return performV4Query(client, fqlQuery, outputFile, flags);
  } else {
    return performV10Query(client, fqlQuery, outputFile, flags);
  }
}

// Remap arguments if a user provide only one
function getArgs() {
  const { stdin, file } = flags;
  const { dbname, query } = args;
  if (dbname && !query && !stdin && !file) return { query: dbname };

  return { dbname, query };
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
  const faunadb = (await import("faunadb")).default

  if (flags.format === "json-tagged") {
    flags.format = "json";
  }

  let res = esprima.parseScript(fqlQuery);
  if (res.body[0].type === "BlockStatement") {
    res = esprima.parseScript(`(${fqlQuery})`);
  }

  try {
    const response = await runQueries(res.body, client);
    return await writeFormattedOutput(outputFile, response, flags.format);
  } catch (error) {
    console.log(error)
    if (error.faunaError === undefined) {
      // this happens when wrapQueries fails during the runInContext step
      // at that point, we have Errors that didn't get run as a query, so
      // they don't have a .faunaError property
      error.message = error.message
    } else if (error.faunaError instanceof faunadb.errors.FaunaHTTPError) {
      error.message =
        util.inspect(JSON.parse(error.faunaError.requestResult.responseRaw), {
          depth: null,
          compact: false,
        })
    } else {
      error.message = error.faunaError.message
    }
    throw error
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
      output = `${res.body.error?.code ?? ""}: ${
        res.body.error?.message ?? ""
      }`;
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

async function doEval(argv) {
  const queryFromStdin = argv.stdin;
  let queriesFile = argv.file;

  const { dbname, query } = argv
  console.log(argv)

  const noSourceSet =
    !queryFromStdin && query === undefined && queriesFile === undefined;
  if (noSourceSet) {
    throw new Error(
      "No source set. Pass --stdin to  read from stdin or --file."
    );
  }

  try {
    const client = dbname
      ? (await ensureDbScopeClient({
        scope: dbname,
        version: argv.version,
        argv
      })).client
      : await (container.resolve("getSimpleClient")(argv))

    const readQuery = queryFromStdin || queriesFile !== undefined;
    let queryFromFile;
    if (readQuery) {
      if (queryFromStdin && !existsSync(queriesFile)) {
        warn("Reading from stdin");
        queriesFile = process.stdin.fd;
      }
      queryFromFile = await readFile(queriesFile);
    }

    const format =
      argv.format ?? (process.stdout.isTTY ? "shell" : "json");

    const performQuery = container.resolve("performQuery");

    const result = await performQuery(
      client,
      queryFromFile || query,
      argv.output,
      {
        format: format,
        version: argv.version,
        typecheck: argv.typecheck,
      }
    );

    if (result) {
      (await container.resolve("logger")).stdout(result);
    }

    // required to make the process not hang
    client.close();

    return result;
  } catch (err) {
    throw err
    // throw new Error(err.message, 1);
  }
}

function buildEvalCommand(yargs) {
  return yargs
    .options({
      url: {
        type: 'string',
        description: 'The Fauna URL to query',
        default: "https://db.fauna.com:443"
      },
      secret: {
        type: 'string',
        description: "The secret to use when calling Fauna",
        required: true
      },
      file: {
        type: 'string',
        description: "File where to read queries from",
      },
      query: {
        type: 'string',
        description: "The query to run",
      },
      dbname: {
        type: 'string',
        description: "The database to run the query against",
      },
      stdin: {
        type: 'boolean',
        description: "Read file input from stdin. Writes to stdout by default",
        default: false,
      },
      output: {
        type: 'string',
        description: "File to write output to",
        default: null,
      },
      format: {
        type: 'string',
        description: "Output format",
        default: 'shell',
        options: EVAL_OUTPUT_FORMATS,
      },
      version: {
        type: 'string',
        description: "FQL Version",
        default: '10',
        choices: ['4', '10'],
      },
      timeout: {
        type: 'number',
        description: "Connection timeout in milliseconds",
        default: 5000
      },

      // v10 specific options
      typecheck: {
        type: 'boolean',
        description: "Enable typechecking",
        default: undefined,
      },
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
    .help()
}

export default {
  builder: buildEvalCommand,
  handler: doEval
}
